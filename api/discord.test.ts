import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Discord admin notifications", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    delete process.env.DISCORD_WEBHOOK_URL;
  });

  afterEach(() => {
    delete process.env.DISCORD_WEBHOOK_URL;
    vi.unstubAllGlobals();
  });

  it("does nothing when the webhook is not configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { notifyNewDeposit } = await import("./discord");

    await notifyNewDeposit({
      depositId: 42,
      publicUserId: 1001,
      amount: 250,
      cryptoType: "trc20",
      email: "kadir@example.com",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a masked, mention-safe admin notification", async () => {
    process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/test/token";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    const { notifyNewDeposit } = await import("./discord");

    await notifyNewDeposit({
      depositId: 42,
      publicUserId: 1001,
      amount: 250,
      cryptoType: "trc20",
      email: "kadir@example.com",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, request] = fetchMock.mock.calls[0];
    const payload = JSON.parse(request.body as string);
    expect(payload.allowed_mentions).toEqual({ parse: [] });
    expect(payload.embeds[0].fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Talep No", value: "#42" }),
        expect.objectContaining({ name: "E-posta", value: "ka***@example.com" }),
      ]),
    );
  });

  it("masks withdrawal contact and wallet details", async () => {
    process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/test/token";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    const { notifyNewWithdrawal } = await import("./discord");

    await notifyNewWithdrawal({
      withdrawalId: 77,
      publicUserId: 1002,
      amount: 125,
      fee: 6.25,
      wallet: "TQx1234567890abcdef",
      email: "member@example.com",
    });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const serialized = JSON.stringify(payload);
    expect(payload.embeds[0].title).toBe("Yeni cekim talebi");
    expect(serialized).toContain("TQx1...abcdef");
    expect(serialized).toContain("me****@example.com");
    expect(serialized).not.toContain("TQx1234567890abcdef");
  });

  it("sends a new-user notification without sensitive credentials", async () => {
    process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/test/token";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    const { notifyNewUser } = await import("./discord");

    await notifyNewUser({
      publicUserId: 1003,
      name: "Yeni Uye",
      email: "newuser@example.com",
      referralCode: "CVTEST",
    });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const serialized = JSON.stringify(payload);
    expect(payload.embeds[0].title).toBe("Yeni kullanici kaydi");
    expect(serialized).toContain("ne*****@example.com");
    expect(serialized).not.toContain("newuser@example.com");
  });

  it("limits support content and disables Discord mentions", async () => {
    process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/test/token";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    const { notifyNewTicket } = await import("./discord");

    await notifyNewTicket({
      ticketId: 88,
      publicUserId: 1004,
      email: "support@example.com",
      subject: `@everyone ${"x".repeat(1200)}`,
    });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const subject = payload.embeds[0].fields.find((field: { name: string }) => field.name === "Konu");
    expect(payload.allowed_mentions).toEqual({ parse: [] });
    expect(subject.value.length).toBeLessThanOrEqual(1024);
  });
});
