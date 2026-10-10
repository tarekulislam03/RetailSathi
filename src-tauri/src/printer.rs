use serde::{Deserialize, Serialize};
#[allow(unused_imports)]
use std::io::Write;
#[allow(unused_imports)]
use std::process::{Command, Stdio};

/// Build a PowerShell command that does not flash a console window on Windows.
#[cfg(target_os = "windows")]
fn hidden_powershell() -> Command {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let mut cmd = Command::new("powershell");
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PrinterInfo {
    pub name: String,
    pub is_default: bool,
    pub status: String,
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn list_printers() -> Result<Vec<PrinterInfo>, String> {
    let mut printers: Vec<PrinterInfo> = Vec::new();
    let mut default_printer = String::new();

    // 1. Get default printer from lpstat -d
    if let Ok(output) = Command::new("lpstat").arg("-d").output() {
        let text = String::from_utf8_lossy(&output.stdout);
        // Format: "system default destination: POS-80"
        if let Some(pos) = text.find(':') {
            default_printer = text[pos + 1..].trim().to_string();
        }
    }

    // 2. Get list of printers from lpstat -p
    if let Ok(output) = Command::new("lpstat").arg("-p").output() {
        let text = String::from_utf8_lossy(&output.stdout);
        for line in text.lines() {
            let line = line.trim();
            // Format: "printer POS-80 is idle..."
            if line.starts_with("printer ") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let name = parts[1].to_string();
                    let is_default = !default_printer.is_empty() && name == default_printer;
                    let status = if line.contains("is idle") {
                        "idle".to_string()
                    } else if line.contains("printing") {
                        "printing".to_string()
                    } else {
                        "ready".to_string()
                    };
                    printers.push(PrinterInfo {
                        name,
                        is_default,
                        status,
                    });
                }
            }
        }
    }

    // 3. Also check for direct USB printer device nodes (/dev/usb/lp0, /dev/usb/lp1, etc.)
    for i in 0..5 {
        let dev_path = format!("/dev/usb/lp{}", i);
        if std::path::Path::new(&dev_path).exists() {
            let is_default = printers.is_empty();
            printers.push(PrinterInfo {
                name: dev_path,
                is_default,
                status: "usb-direct".to_string(),
            });
        }
    }

    Ok(printers)
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn list_printers() -> Result<Vec<PrinterInfo>, String> {
    let mut printers: Vec<PrinterInfo> = Vec::new();

    // Query printers using PowerShell
    let ps_script = "Get-Printer | Select-Object Name, Default | ConvertTo-Json";
    if let Ok(output) = hidden_powershell()
        .args(["-NoProfile", "-WindowStyle", "Hidden", "-NonInteractive", "-Command", ps_script])
        .output()
    {
        let text = String::from_utf8_lossy(&output.stdout);
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
            if let Some(arr) = val.as_array() {
                for item in arr {
                    let name = item["Name"].as_str().unwrap_or("").to_string();
                    let is_default = item["Default"].as_bool().unwrap_or(false);
                    if !name.is_empty() {
                        printers.push(PrinterInfo {
                            name,
                            is_default,
                            status: "ready".to_string(),
                        });
                    }
                }
            } else if let Some(obj) = val.as_object() {
                let name = obj.get("Name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let is_default = obj.get("Default").and_then(|v| v.as_bool()).unwrap_or(false);
                if !name.is_empty() {
                    printers.push(PrinterInfo {
                        name,
                        is_default,
                        status: "ready".to_string(),
                    });
                }
            }
        }
    }

    Ok(printers)
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn print_raw_escpos(bytes: Vec<u8>, printer_name: Option<String>) -> Result<String, String> {
    if bytes.is_empty() {
        return Err("No print data provided.".to_string());
    }

    let target_printer = printer_name.unwrap_or_default().trim().to_string();

    // Case 1: Direct device node (/dev/usb/lp*)
    if target_printer.starts_with("/dev/") {
        match std::fs::OpenOptions::new().write(true).open(&target_printer) {
            Ok(mut file) => {
                if let Err(e) = file.write_all(&bytes) {
                    return Err(format!("Failed to write to direct USB device {}: {}", target_printer, e));
                }
                return Ok(format!("Printed directly to {}", target_printer));
            }
            Err(e) => {
                return Err(format!("Could not open direct device {}: {}", target_printer, e));
            }
        }
    }

    // Case 2: Specific CUPS printer name provided
    if !target_printer.is_empty() && target_printer != "auto" {
        let mut child = Command::new("lp")
            .arg("-d")
            .arg(&target_printer)
            .arg("-o")
            .arg("raw")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn lp command: {}", e))?;

        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(&bytes).map_err(|e| format!("Failed to send data to printer: {}", e))?;
        }

        let output = child.wait_with_output().map_err(|e| format!("Printer process error: {}", e))?;
        if output.status.success() {
            return Ok(format!("Printed to {}", target_printer));
        } else {
            let err_msg = String::from_utf8_lossy(&output.stderr);
            return Err(format!("CUPS lp error ({}): {}", target_printer, err_msg.trim()));
        }
    }

    // Case 3: Auto-detect printer
    // Try to find known receipt printer or default printer from list_printers
    let detected = list_printers().unwrap_or_default();
    
    // Priority: Default printer -> Thermal/POS named printer -> Direct /dev/usb/lp* -> Any printer
    let mut selected: Option<String> = None;

    if let Some(p) = detected.iter().find(|p| p.is_default && !p.name.starts_with("/dev/")) {
        selected = Some(p.name.clone());
    } else if let Some(p) = detected.iter().find(|p| {
        let n = p.name.to_lowercase();
        n.contains("pos") || n.contains("thermal") || n.contains("receipt") || n.contains("80") || n.contains("58") || n.contains("printer")
    }) {
        selected = Some(p.name.clone());
    } else if let Some(p) = detected.first() {
        selected = Some(p.name.clone());
    }

    if let Some(printer) = selected {
        if printer.starts_with("/dev/") {
            if let Ok(mut file) = std::fs::OpenOptions::new().write(true).open(&printer) {
                if file.write_all(&bytes).is_ok() {
                    return Ok(format!("Printed directly to auto-detected {}", printer));
                }
            }
        } else {
            let mut child = Command::new("lp")
                .arg("-d")
                .arg(&printer)
                .arg("-o")
                .arg("raw")
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to spawn lp command: {}", e))?;

            if let Some(mut stdin) = child.stdin.take() {
                stdin.write_all(&bytes).map_err(|e| format!("Failed to send data to printer: {}", e))?;
            }

            let output = child.wait_with_output().map_err(|e| format!("Printer process error: {}", e))?;
            if output.status.success() {
                return Ok(format!("Printed to {}", printer));
            }
        }
    }

    // Direct USB fallback scan
    for i in 0..4 {
        let dev_path = format!("/dev/usb/lp{}", i);
        if let Ok(mut file) = std::fs::OpenOptions::new().write(true).open(&dev_path) {
            if file.write_all(&bytes).is_ok() {
                return Ok(format!("Printed directly to {}", dev_path));
            }
        }
    }

    // Generic lp -o raw fallback
    let mut child = Command::new("lp")
        .arg("-o")
        .arg("raw")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn lp command: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(&bytes).map_err(|e| format!("Failed to send data to printer: {}", e))?;
    }

    let output = child.wait_with_output().map_err(|e| format!("Printer process error: {}", e))?;
    if output.status.success() {
        Ok("Printed to default printer".to_string())
    } else {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        Err(format!("Printing failed: {}", err_msg.trim()))
    }
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn print_raw_escpos(bytes: Vec<u8>, printer_name: Option<String>) -> Result<String, String> {
    if bytes.is_empty() {
        return Err("No print data provided.".to_string());
    }

    let target = printer_name.unwrap_or_default().trim().to_string();
    let temp_file = std::env::temp_dir().join(format!("receipt_{}.bin", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()));
    
    std::fs::write(&temp_file, &bytes).map_err(|e| format!("Failed to write temp print file: {}", e))?;
    let temp_str = temp_file.to_string_lossy().to_string();

    let target_printer = if !target.is_empty() && target != "auto" {
        target
    } else {
        // Auto-detect default or thermal printer
        let printers = list_printers().unwrap_or_default();
        let default_or_pos = printers.iter().find(|p| p.is_default)
            .or_else(|| printers.iter().find(|p| {
                let n = p.name.to_lowercase();
                n.contains("pos") || n.contains("thermal") || n.contains("receipt") || n.contains("80") || n.contains("58")
            }))
            .or_else(|| printers.first());
        
        match default_or_pos {
            Some(p) => p.name.clone(),
            None => "".to_string(),
        }
    };

    let ps_command = if target_printer.is_empty() {
        format!(
            r#"[System.IO.File]::ReadAllBytes('{0}') | Out-Printer"#,
            temp_str.replace("'", "''")
        )
    } else {
        // Use Winspool Raw Print via PowerShell or copy /b
        format!(
            r#"
            $printerName = '{1}'
            $filePath = '{0}'
            
            $code = @"
            using System;
            using System.IO;
            using System.Runtime.InteropServices;

            public class RawPrinterHelper
            {{
                [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
                public class DOCINFOA
                {{
                    [MarshalAs(UnmanagedType.LPStr)]
                    public string pDocName;
                    [MarshalAs(UnmanagedType.LPStr)]
                    public string pOutputFile;
                    [MarshalAs(UnmanagedType.LPStr)]
                    public string pDataType;
                }}

                [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
                public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

                [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
                public static extern bool ClosePrinter(IntPtr hPrinter);

                [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
                public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

                [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
                public static extern bool EndDocPrinter(IntPtr hPrinter);

                [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
                public static extern bool StartPagePrinter(IntPtr hPrinter);

                [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
                public static extern bool EndPagePrinter(IntPtr hPrinter);

                [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
                public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

                public static bool SendBytesToPrinter(string szPrinterName, byte[] pBytes)
                {{
                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(pBytes.Length);
                    Marshal.Copy(pBytes, 0, pUnmanagedBytes, pBytes.Length);
                    IntPtr hPrinter;
                    DOCINFOA di = new DOCINFOA();
                    di.pDocName = "RetailSathi_Receipt";
                    di.pDataType = "RAW";
                    bool bSuccess = false;

                    if (OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero))
                    {{
                        if (StartDocPrinter(hPrinter, 1, di))
                        {{
                            if (StartPagePrinter(hPrinter))
                            {{
                                int dwWritten = 0;
                                bSuccess = WritePrinter(hPrinter, pUnmanagedBytes, pBytes.Length, out dwWritten);
                                EndPagePrinter(hPrinter);
                            }}
                            EndDocPrinter(hPrinter);
                        }}
                        ClosePrinter(hPrinter);
                    }}
                    Marshal.FreeCoTaskMem(pUnmanagedBytes);
                    return bSuccess;
                }}
            }}
"@
            Add-Type -TypeDefinition $code
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $res = [RawPrinterHelper]::SendBytesToPrinter($printerName, $bytes)
            if (-not $res) {{ exit 1 }}
            "#,
            temp_str.replace("'", "''"),
            target_printer.replace("'", "''")
        )
    };

    let status = hidden_powershell()
        .args(["-NoProfile", "-WindowStyle", "Hidden", "-NonInteractive", "-Command", &ps_command])
        .status();

    let _ = std::fs::remove_file(&temp_file);

    match status {
        Ok(s) if s.success() => Ok(format!("Printed to {}", target_printer)),
        Ok(s) => Err(format!("Windows printer failed with exit code: {}", s)),
        Err(e) => Err(format!("Failed to execute Windows print command: {}", e)),
    }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn print_raw_tspl(printer_name: Option<String>, tspl_string: String) -> Result<String, String> {
    if tspl_string.trim().is_empty() {
        return Err("No TSPL label data provided.".to_string());
    }
    let bytes = tspl_string.into_bytes();
    print_raw_escpos(bytes, printer_name)
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn print_raw_tspl(printer_name: Option<String>, tspl_string: String) -> Result<String, String> {
    if tspl_string.trim().is_empty() {
        return Err("No TSPL label data provided.".to_string());
    }
    let bytes = tspl_string.into_bytes();
    print_raw_escpos(bytes, printer_name)
}

#[tauri::command]
pub fn print_raw(printer_name: String, data: Vec<u8>) -> Result<String, String> {
    if data.is_empty() {
        return Err("No print data provided.".to_string());
    }
    let p_opt = if printer_name.trim().is_empty() {
        None
    } else {
        Some(printer_name)
    };
    print_raw_escpos(data, p_opt)
}

