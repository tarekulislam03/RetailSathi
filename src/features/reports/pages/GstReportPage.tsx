import React, { useEffect, useMemo, useState } from "react";
import { useDbRefresh } from "../../../hooks/useDbRefresh";
import { GstCommonLayout } from "../components/GstCommonLayout";
import { GstHomeView } from "../components/GstHomeView";
import { Gstr1SectionView, Gstr1SummaryView } from "../components/Gstr1Views";
import { Gstr3bView } from "../components/Gstr3bView";
import {
  HsnSummaryView,
  InputOutputView,
  InvoiceDetailView,
  RateSummaryView,
  VoucherRegisterView,
} from "../components/GstDetailViews";
import { GstCaPackView } from "../components/GstCaPackView";
import { buildGstCaPackData, GstCaPackData } from "../services/gstCaPackService";
import {
  exportGstCaPackCsv,
  exportGstCaPackExcel,
  exportGstCaPackPdf,
} from "../services/gstCaPackPdfService";
import { fetchGstTallyReportBundle } from "../services/gstTallyService";
import { exportGstTallyPdf } from "../services/gstTallyPdfService";
import {
  BreadcrumbItem,
  GstPageId,
  GstTallyReportBundle,
  GstVoucher,
  Gstr1SectionId,
  PeriodMode,
  VoucherFilterContext,
} from "../types/gstTallyTypes";

export const GstReportPage: React.FC = () => {
  const [bundle, setBundle] = useState<GstTallyReportBundle | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);

  // Filters
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedCounter, setSelectedCounter] = useState<string>("ALL");
  const [caThreshold, setCaThreshold] = useState<number>(500000);
  const [caPack, setCaPack] = useState<GstCaPackData | null>(null);
  const [caExporting, setCaExporting] = useState<string | null>(null);

  // Navigation stack (Breadcrumbs)
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { label: "GST Reports", page: "home" },
  ]);

  const currentCrumb = breadcrumbs[breadcrumbs.length - 1];

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const data = await fetchGstTallyReportBundle({
        periodMode,
        startDate,
        endDate,
        counter: selectedCounter,
      });
      setBundle(data);
    } catch (err: any) {
      if (!silent) {
        console.error("Failed to load GST Tally report:", err);
        setError(err?.message || "Failed to load GST report.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useDbRefresh(() => loadData(true), 4000);

  useEffect(() => {
    loadData();
  }, [startDate, endDate, selectedCounter]);

  useEffect(() => {
    if (!bundle) return;
    buildGstCaPackData(bundle, caThreshold)
      .then(setCaPack)
      .catch((err) => console.error("Failed to build CA Pack:", err));
  }, [bundle, caThreshold]);

  const pushCrumb = (crumb: BreadcrumbItem) => {
    setBreadcrumbs((prev) => [...prev, crumb]);
  };

  const handleNavigateBreadcrumb = (index: number) => {
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  };

  const handleOpenPage = (page: GstPageId, label: string) => {
    pushCrumb({ label, page });
  };

  const handleOpenSection = (sectionId: Gstr1SectionId, label: string) => {
    pushCrumb({ label, page: "gstr1_section", sectionId });
  };

  const handleOpenVouchers = (filterContext: VoucherFilterContext, label: string) => {
    pushCrumb({ label, page: "voucher_register", filterContext });
  };

  const handleOpenVoucher = (voucher: GstVoucher) => {
    pushCrumb({
      label: `${voucher.voucherType} #${voucher.voucherNo}`,
      page: "invoice_view",
      voucherId: voucher.id,
    });
  };

  // Resolve filtered vouchers for Voucher Register
  const filteredVouchers = useMemo(() => {
    if (!bundle) return [];
    const ctx = currentCrumb.filterContext;
    let list = bundle.allVouchers;
    if (ctx?.direction === "outward") list = bundle.outwardVouchers;
    else if (ctx?.direction === "inward") list = bundle.inwardVouchers;

    if (ctx?.voucherIds) {
      const idSet = new Set(ctx.voucherIds);
      list = list.filter((v) => idSet.has(v.id));
    }
    if (ctx?.onlyIncomplete) {
      list = list.filter((v) => v.mismatchReasons.length > 0);
    }
    return list;
  }, [bundle, currentCrumb]);

  const activeVoucher = useMemo(() => {
    if (!bundle || !currentCrumb.voucherId) return null;
    return bundle.allVouchers.find((v) => v.id === currentCrumb.voucherId) || null;
  }, [bundle, currentCrumb]);

  const getPageTitle = (page: GstPageId): string => {
    switch (page) {
      case "home":
        return "GST REPORTS — GATEWAY";
      case "gstr1_summary":
        return "GSTR-1 SUMMARY";
      case "gstr1_section":
        return `GSTR-1 SECTION VIEW — ${currentCrumb.label.toUpperCase()}`;
      case "voucher_register":
        return currentCrumb.filterContext?.title?.toUpperCase() || "GST VOUCHER REGISTER";
      case "invoice_view":
        return `TAX INVOICE / VOUCHER VIEW — ${activeVoucher?.voucherNo || ""}`;
      case "gstr3b":
        return "GSTR-3B SUMMARY RETURN";
      case "hsn_summary":
        return "HSN-WISE SUMMARY";
      case "rate_summary":
        return "TAX RATE-WISE SUMMARY";
      case "input_output":
        return "INPUT vs OUTPUT TAX";
      case "ca_pack":
        return "CA GST AUDIT PACK (13-PAGE REPORT)";
      default:
        return "GST REPORTS";
    }
  };

  const handleExportPdf = async () => {
    if (!bundle) return;
    try {
      setExportingPdf(true);
      const res =
        (currentCrumb.page === "ca_pack" || currentCrumb.page === "home") && caPack
          ? await exportGstCaPackPdf(caPack)
          : await exportGstTallyPdf(bundle, {
              page: currentCrumb.page,
              counter: selectedCounter,
              sectionId: currentCrumb.sectionId,
              voucher: activeVoucher,
              filteredVouchers,
              voucherContext: currentCrumb.filterContext,
            });
      if (res.filePath) {
        alert(`PDF exported successfully!\n\nSaved to: ${res.filePath}`);
      } else {
        alert("PDF generated and downloaded successfully!");
      }
    } catch (err: any) {
      console.error("PDF export failed:", err);
      alert("Failed to export PDF: " + (err?.message || err));
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading && !bundle) {
    return (
      <div style={{ padding: "40px", textAlign: "center", fontSize: "0.95rem" }}>
        Loading GST Reports...
      </div>
    );
  }

  if (error && !bundle) {
    return (
      <div style={{ padding: "20px", color: "#991b1b", background: "#fef2f2", border: "1px solid #b91c1c", margin: "16px" }}>
        {error}
      </div>
    );
  }

  if (!bundle) return null;

  const reconciliation =
    currentCrumb.page === "gstr3b" || currentCrumb.page === "input_output"
      ? bundle.reconciliation.combined
      : bundle.reconciliation.outward;

  return (
    <GstCommonLayout
      store={bundle.store}
      reportTitle={getPageTitle(currentCrumb.page)}
      periodLabel={bundle.periodLabel}
      periodMode={periodMode}
      onPeriodModeChange={setPeriodMode}
      startDate={startDate}
      endDate={endDate}
      onDateRangeChange={(s, e) => {
        setStartDate(s);
        setEndDate(e);
      }}
      counters={bundle.counters}
      selectedCounter={selectedCounter}
      onCounterChange={setSelectedCounter}
      breadcrumbs={breadcrumbs}
      onNavigateBreadcrumb={handleNavigateBreadcrumb}
      onExportPdf={handleExportPdf}
      onPrint={() => window.print()}
      exportingPdf={exportingPdf}
      loading={loading}
      reconciliation={reconciliation}
    >
      {currentCrumb.page === "home" && (
        <GstHomeView bundle={bundle} onOpenPage={handleOpenPage} />
      )}

      {currentCrumb.page === "gstr1_summary" && (
        <Gstr1SummaryView
          bundle={bundle}
          onOpenSection={handleOpenSection}
          onOpenVouchers={handleOpenVouchers}
        />
      )}

      {currentCrumb.page === "gstr1_section" && currentCrumb.sectionId && (
        <Gstr1SectionView
          bundle={bundle}
          sectionId={currentCrumb.sectionId}
          onOpenVoucher={handleOpenVoucher}
          onOpenVouchers={handleOpenVouchers}
        />
      )}

      {currentCrumb.page === "voucher_register" && (
        <VoucherRegisterView
          vouchers={filteredVouchers}
          title={currentCrumb.filterContext?.title}
          onOpenVoucher={handleOpenVoucher}
        />
      )}

      {currentCrumb.page === "invoice_view" && activeVoucher && (
        <InvoiceDetailView voucher={activeVoucher} />
      )}

      {currentCrumb.page === "gstr3b" && (
        <Gstr3bView bundle={bundle} onOpenVouchers={handleOpenVouchers} />
      )}

      {currentCrumb.page === "hsn_summary" && (
        <HsnSummaryView bundle={bundle} onOpenVouchers={handleOpenVouchers} />
      )}

      {currentCrumb.page === "rate_summary" && (
        <RateSummaryView bundle={bundle} onOpenVouchers={handleOpenVouchers} />
      )}

      {currentCrumb.page === "input_output" && (
        <InputOutputView bundle={bundle} onOpenVouchers={handleOpenVouchers} />
      )}

      {currentCrumb.page === "ca_pack" && caPack && (
        <GstCaPackView
          pack={caPack}
          amountThreshold={caThreshold}
          onThresholdChange={setCaThreshold}
          onExportPdf={handleExportPdf}
          onExportExcel={async () => {
            try {
              setCaExporting("xlsx");
              const r = await exportGstCaPackExcel(caPack);
              alert(r.filePath ? `Excel saved to: ${r.filePath}` : "Excel exported!");
            } finally {
              setCaExporting(null);
            }
          }}
          onExportCsv={async () => {
            try {
              setCaExporting("csv");
              const r = await exportGstCaPackCsv(caPack);
              alert(r.filePath ? `CSV saved to: ${r.filePath}` : "CSV exported!");
            } finally {
              setCaExporting(null);
            }
          }}
          exporting={caExporting}
        />
      )}
    </GstCommonLayout>
  );
};
