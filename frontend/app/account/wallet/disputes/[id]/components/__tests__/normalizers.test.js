import {
  normalizeCurrentUser,
  normalizeDisputeMessage,
  normalizeDisputeEvidence,
  normalizeDispute,
} from "../normalizers";

jest.mock("@/lib/featureApi", () => ({
  unwrapFeatureData: jest.fn((d) => d),
  extractFeatureItems: jest.fn((d) => (Array.isArray(d) ? d : [])),
}));

describe("wallet dispute normalizers", () => {
  describe("normalizeCurrentUser", () => {
    it("extracts id and username", () => {
      const result = normalizeCurrentUser({ id: 42, username: "alice" });
      expect(result.id).toBe(42);
      expect(result.username).toBe("alice");
    });

    it("defaults to 0 id and empty username", () => {
      const result = normalizeCurrentUser({});
      expect(result.id).toBe(0);
      expect(result.username).toBe("");
    });

    it("handles userId alias", () => {
      const result = normalizeCurrentUser({ userId: 10, username: "bob" });
      expect(result.id).toBe(10);
    });
  });

  describe("normalizeDisputeMessage", () => {
    it("normalizes message fields", () => {
      const msg = normalizeDisputeMessage({
        id: "msg-1",
        senderId: 5,
        senderUsername: "alice",
        isAdmin: false,
        content: "Hello",
        createdAt: "2024-01-01",
      });
      expect(msg.id).toBe("msg-1");
      expect(msg.senderId).toBe(5);
      expect(msg.senderUsername).toBe("alice");
      expect(msg.content).toBe("Hello");
      expect(msg.createdAt).toBe("2024-01-01");
    });

    it("defaults missing fields", () => {
      const msg = normalizeDisputeMessage({});
      expect(msg.id).toBe("");
      expect(msg.senderUsername).toBe("User");
      expect(msg.isAdmin).toBe(false);
    });
  });

  describe("normalizeDisputeEvidence", () => {
    it("normalizes evidence fields", () => {
      const ev = normalizeDisputeEvidence({
        id: "ev-1",
        description: "Screenshot",
        fileUrl: "https://cdn.example.com/img.png",
        createdAt: "2024-01-01",
        user: { username: "alice" },
      });
      expect(ev.id).toBe("ev-1");
      expect(ev.description).toBe("Screenshot");
      expect(ev.fileUrl).toBe("https://cdn.example.com/img.png");
      expect(ev.username).toBe("alice");
    });

    it("defaults missing fields", () => {
      const ev = normalizeDisputeEvidence({});
      expect(ev.id).toBe("");
      expect(ev.username).toBe("User");
    });
  });

  describe("normalizeDispute", () => {
    it("normalizes full dispute object", () => {
      const dispute = normalizeDispute({
        id: "d-1",
        status: "Open",
        phase: "negotiation",
        amount: 50000,
        senderId: 1,
        receiverId: 2,
        senderUsername: "alice",
        receiverUsername: "bob",
        messages: [],
        evidence: [],
      });
      expect(dispute.id).toBe("d-1");
      expect(dispute.status).toBe("open");
      expect(dispute.phase).toBe("negotiation");
      expect(dispute.amount).toBe(50000);
      expect(dispute.senderUsername).toBe("alice");
      expect(dispute.receiverUsername).toBe("bob");
      expect(dispute.messages).toEqual([]);
      expect(dispute.evidence).toEqual([]);
    });

    it("handles admin_review phase mapping", () => {
      const dispute = normalizeDispute({ phase: "AdminReview" });
      expect(dispute.phase).toBe("admin_review");
    });

    it("defaults to negotiation phase", () => {
      const dispute = normalizeDispute({});
      expect(dispute.phase).toBe("negotiation");
    });
  });
});
