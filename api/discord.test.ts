import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("notifyNewDeposit", () => {
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
});
