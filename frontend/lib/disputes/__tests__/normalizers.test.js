import {
  normalizeCurrentUser,
  normalizeDisputeMessage,
  normalizeDisputeEvidence,
  normalizeDispute,
} from "../normalizers";

jest.mock("@/lib/featureApi", () => ({
  unwrapFeatureData: jest.fn((payload) => payload?.data || payload),
  extractFeatureItems: jest.fn((items) => (Array.isArray(items) ? items : [])),
}));

describe("normalizers", () => {
  describe("normalizeCurrentUser", () => {
    it("extracts id and username from payload", () => {
      const result = normalizeCurrentUser({ id: 42, username: "alice" });
      expect(result).toEqual({ id: 42, username: "alice" });
    });

    it("falls back to alternative field names", () => {
      const result = normalizeCurrentUser({ user_id: 10, Username: "bob" });
      expect(result.id).toBe(10);
      expect(result.username).toBe("bob");
    });

    it("returns defaults for empty payload", () => {
      expect(normalizeCurrentUser(null)).toEqual({ id: 0, username: "" });
      expect(normalizeCurrentUser(undefined)).toEqual({ id: 0, username: "" });
    });
  });

  describe("normalizeDisputeMessage", () => {
    it("normalizes a message object", () => {
      const msg = {
        id: "m1",
        senderId: 5,
        senderUsername: "alice",
        isAdmin: false,
        content: "Hello",
        createdAt: "2024-01-01T00:00:00Z",
      };
      const result = normalizeDisputeMessage(msg);
      expect(result).toEqual({
        id: "m1",
        senderId: 5,
        senderUsername: "alice",
        isAdmin: false,
        content: "Hello",
        createdAt: "2024-01-01T00:00:00Z",
      });
    });

    it("uses alternative field names (PascalCase)", () => {
      const msg = {
        Id: "m2",
        SenderId: 7,
        SenderUsername: "bob",
        IsAdmin: true,
        Content: "Hi",
        CreatedAt: "2024-02-01",
      };
      const result = normalizeDisputeMessage(msg);
      expect(result.id).toBe("m2");
      expect(result.senderId).toBe(7);
      expect(result.isAdmin).toBe(true);
      expect(result.content).toBe("Hi");
    });

    it("provides defaults for missing fields", () => {
      const result = normalizeDisputeMessage({});
      expect(result.id).toBe("");
      expect(result.senderId).toBe(0);
      expect(result.senderUsername).toBe("User");
      expect(result.isAdmin).toBe(false);
      expect(result.content).toBe("");
      expect(result.createdAt).toBeNull();
    });
  });

  describe("normalizeDisputeEvidence", () => {
    it("normalizes an evidence object", () => {
      const evidence = {
        id: "e1",
        description: "Screenshot",
        fileUrl: "https://img.test/file.png",
        createdAt: "2024-01-01",
        username: "alice",
      };
      const result = normalizeDisputeEvidence(evidence);
      expect(result.id).toBe("e1");
      expect(result.description).toBe("Screenshot");
      expect(result.fileUrl).toBe("https://img.test/file.png");
      expect(result.username).toBe("alice");
    });

    it("extracts username from nested user object", () => {
      const evidence = { user: { username: "nested_user" } };
      expect(normalizeDisputeEvidence(evidence).username).toBe("nested_user");
    });
  });

  describe("normalizeDispute", () => {
    it("normalizes a full dispute payload", () => {
      const payload = {
        data: {
          id: "d1",
          status: "Open",
          phase: "negotiation",
          amount: 1000,
          senderId: 1,
          receiverId: 2,
          senderUsername: "sender",
          receiverUsername: "receiver",
          messages: [],
          evidence: [],
        },
      };
      const result = normalizeDispute(payload);
      expect(result.id).toBe("d1");
      expect(result.status).toBe("open");
      expect(result.phase).toBe("negotiation");
      expect(result.amount).toBe(1000);
      expect(result.senderId).toBe(1);
      expect(result.receiverId).toBe(2);
    });

    it("maps admin_review phase variants correctly", () => {
      const payload = { data: { phase: "AdminReview" } };
      expect(normalizeDispute(payload).phase).toBe("admin_review");

      const payload2 = { data: { phase: "under_review" } };
      expect(normalizeDispute(payload2).phase).toBe("admin_review");
    });

    it("defaults to negotiation for unknown phase", () => {
      const payload = { data: { phase: "unknown_phase" } };
      expect(normalizeDispute(payload).phase).toBe("negotiation");
    });

    it("handles null/empty payload gracefully", () => {
      const result = normalizeDispute(null);
      expect(result.id).toBe("");
      expect(result.status).toBe("open");
      expect(result.amount).toBe(0);
      expect(result.messages).toEqual([]);
      expect(result.evidence).toEqual([]);
    });
  });
});
