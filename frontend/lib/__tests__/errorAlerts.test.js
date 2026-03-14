import { mapApiErrorToAlert } from "../errorAlerts";

describe("errorAlerts.js", () => {
  describe("mapApiErrorToAlert", () => {
    it("should map known error code AUTH005", () => {
      const alert = mapApiErrorToAlert({ code: "AUTH005" });
      expect(alert.variant).toBe("error");
      expect(alert.title).toBe("Invalid token");
      expect(alert.message).toBeDefined();
    });

    it("should map known error code AUTH012", () => {
      const alert = mapApiErrorToAlert({ code: "AUTH012" });
      expect(alert.variant).toBe("warning");
      expect(alert.title).toBe("Account temporarily locked");
    });

    it("should map known error code RATE001", () => {
      const alert = mapApiErrorToAlert({ code: "RATE001" });
      expect(alert.variant).toBe("warning");
      expect(alert.title).toBe("Too many requests");
    });

    it("should use default alert for unknown code", () => {
      const alert = mapApiErrorToAlert({ code: "UNKNOWN", message: "Something went wrong" });
      expect(alert.variant).toBe("error");
      expect(alert.title).toBe("An error occurred");
      expect(alert.message).toBe("Something went wrong");
    });

    it("should handle string error", () => {
      const alert = mapApiErrorToAlert("Something broke");
      expect(alert.message).toBe("Something broke");
    });

    it("should handle null error", () => {
      const alert = mapApiErrorToAlert(null);
      expect(alert.variant).toBe("error");
      expect(alert.message).toBeDefined();
    });

    it("should handle undefined error", () => {
      const alert = mapApiErrorToAlert(undefined);
      expect(alert.variant).toBe("error");
    });

    it("should include details when different from message", () => {
      const alert = mapApiErrorToAlert({
        message: "Error occurred",
        details: "Extra context",
      });
      expect(alert.message).toContain("Extra context");
    });

    it("should not duplicate details when same as message", () => {
      const alert = mapApiErrorToAlert({
        message: "Same message",
        details: "Same message",
      });
      expect(alert.message).toBe("Same message");
    });
  });
});
