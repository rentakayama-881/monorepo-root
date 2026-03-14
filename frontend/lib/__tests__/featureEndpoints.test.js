import { FEATURE_ENDPOINTS } from "../featureEndpoints";

describe("featureEndpoints.js", () => {
  describe("static endpoints", () => {
    it("should have health endpoint", () => {
      expect(FEATURE_ENDPOINTS.HEALTH).toBe("/api/v1/health");
    });

    it("should have documents list endpoint", () => {
      expect(FEATURE_ENDPOINTS.DOCUMENTS.LIST).toBe("/api/v1/documents");
    });

    it("should have wallets endpoint", () => {
      expect(FEATURE_ENDPOINTS.WALLETS.ME).toBe("/api/v1/wallets/me");
    });

    it("should have transfers list endpoint", () => {
      expect(FEATURE_ENDPOINTS.TRANSFERS.LIST).toBe("/api/v1/wallets/transfers");
    });

    it("should have disputes list endpoint", () => {
      expect(FEATURE_ENDPOINTS.DISPUTES.LIST).toBe("/api/v1/disputes");
    });
  });

  describe("dynamic endpoints", () => {
    it("should build document detail URL", () => {
      expect(FEATURE_ENDPOINTS.DOCUMENTS.DETAIL("doc-123")).toBe("/api/v1/documents/doc-123");
    });

    it("should build document download URL", () => {
      expect(FEATURE_ENDPOINTS.DOCUMENTS.DOWNLOAD("doc-1")).toBe(
        "/api/v1/documents/doc-1/download"
      );
    });

    it("should build transfer detail URL", () => {
      expect(FEATURE_ENDPOINTS.TRANSFERS.DETAIL("t-1")).toBe("/api/v1/wallets/transfers/t-1");
    });

    it("should build transfer by code URL", () => {
      expect(FEATURE_ENDPOINTS.TRANSFERS.BY_CODE("CODE123")).toBe(
        "/api/v1/wallets/transfers/code/CODE123"
      );
    });

    it("should build dispute respond URL", () => {
      expect(FEATURE_ENDPOINTS.DISPUTES.RESPOND("d-1")).toBe("/api/v1/disputes/d-1/respond");
    });

    it("should build withdrawal cancel URL", () => {
      expect(FEATURE_ENDPOINTS.WITHDRAWALS.CANCEL("w-1")).toBe(
        "/api/v1/wallets/withdrawals/w-1/cancel"
      );
    });

    it("should build admin device ban detail URL", () => {
      expect(FEATURE_ENDPOINTS.ADMIN.DEVICE_BAN_DETAIL("ban-1")).toBe(
        "/api/v1/admin/moderation/device-bans/ban-1"
      );
    });

    it("should build document public URL", () => {
      expect(FEATURE_ENDPOINTS.DOCUMENTS.PUBLIC("user-1")).toBe("/api/v1/documents/user/user-1");
    });
  });
});
