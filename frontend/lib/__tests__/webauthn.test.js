import { bufferToBase64URL, base64URLToBuffer } from "../webauthn";

describe("webauthn.js", () => {
  describe("bufferToBase64URL", () => {
    it("should convert empty buffer", () => {
      const buffer = new ArrayBuffer(0);
      expect(bufferToBase64URL(buffer)).toBe("");
    });

    it("should convert known bytes to base64url", () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const result = bufferToBase64URL(bytes.buffer);
      expect(result).toBe("SGVsbG8");
    });

    it("should not contain + / = characters", () => {
      // Create bytes that would produce +, /, = in standard base64
      const bytes = new Uint8Array([255, 254, 253, 252]);
      const result = bufferToBase64URL(bytes.buffer);
      expect(result).not.toContain("+");
      expect(result).not.toContain("/");
      expect(result).not.toContain("=");
    });
  });

  describe("base64URLToBuffer", () => {
    it("should convert base64url back to buffer", () => {
      const base64url = "SGVsbG8"; // "Hello"
      const buffer = base64URLToBuffer(base64url);
      const bytes = new Uint8Array(buffer);
      expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]);
    });

    it("should handle base64url with replaced characters", () => {
      // Base64url uses - and _ instead of + and /
      const bytes = new Uint8Array([255, 254, 253]);
      const encoded = bufferToBase64URL(bytes.buffer);
      const decoded = new Uint8Array(base64URLToBuffer(encoded));
      expect(Array.from(decoded)).toEqual([255, 254, 253]);
    });

    it("should round-trip arbitrary data", () => {
      const original = new Uint8Array([0, 1, 2, 128, 255]);
      const encoded = bufferToBase64URL(original.buffer);
      const decoded = new Uint8Array(base64URLToBuffer(encoded));
      expect(Array.from(decoded)).toEqual(Array.from(original));
    });

    it("should handle padding correctly", () => {
      // 1 byte -> 2 base64 chars + 2 padding
      const bytes = new Uint8Array([65]); // "A"
      const encoded = bufferToBase64URL(bytes.buffer);
      const decoded = new Uint8Array(base64URLToBuffer(encoded));
      expect(Array.from(decoded)).toEqual([65]);
    });
  });
});
