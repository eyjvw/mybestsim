// Web Worker: loads and summarises the live catalog off the main thread (see src/lib/live.ts).
import { answer, type LiveReply, type LiveRequest } from "../lib/live";

const scope = self as unknown as {
  onmessage: (e: MessageEvent<LiveRequest>) => void;
  postMessage: (reply: LiveReply) => void;
};
scope.onmessage = async (e) => scope.postMessage(await answer(e.data));
