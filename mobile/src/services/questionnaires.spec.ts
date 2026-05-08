import { QuestionnairesService } from "./questionnaires";

jest.mock("./api", () => ({
  api: {
    get: jest.fn().mockResolvedValue({ data: [] }),
    post: jest.fn().mockResolvedValue({ data: { id: "r1", totalScore: 10 } }),
  },
}));

jest.mock("./offlineQueue", () => ({
  OfflineQueue: { enqueue: jest.fn() },
}));

describe("QuestionnairesService", () => {
  it("getPending calls the correct endpoint", async () => {
    const { api } = require("./api");
    await QuestionnairesService.getPending();
    expect(api.get).toHaveBeenCalledWith("/patient-portal/questionnaires/pending");
  });

  it("submit returns result on success", async () => {
    const res = await QuestionnairesService.submit("q1", { responses: [] });
    expect(res.result?.id).toBe("r1");
    expect(res.queued).toBeUndefined();
  });

  it("submit enqueues on network error", async () => {
    const { api } = require("./api");
    const { OfflineQueue } = require("./offlineQueue");
    api.post.mockRejectedValueOnce({ code: "ERR_NETWORK" });
    const res = await QuestionnairesService.submit("q1", { responses: [] });
    expect(res.queued).toBe(true);
    expect(OfflineQueue.enqueue).toHaveBeenCalled();
  });
});