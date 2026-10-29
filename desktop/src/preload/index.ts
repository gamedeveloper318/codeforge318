import { contextBridge, ipcRenderer } from "electron";
import {
  EVENT_CHANNELS,
  INVOKE_CHANNELS,
  SEND_CHANNELS,
  type CodeForgeBridge,
  type IpcResult,
} from "@shared/ipc";

// The preload runs sandboxed: it can only reach main through these
// allow-listed channels. No Node.js APIs are exposed to the page.
const invokeChannels = new Set<string>(INVOKE_CHANNELS);
const sendChannels = new Set<string>(SEND_CHANNELS);
const eventChannels = new Set<string>(EVENT_CHANNELS);

const bridge: CodeForgeBridge = {
  async invoke(channel, ...args) {
    if (!invokeChannels.has(channel)) throw new Error(`Blocked IPC channel: ${channel}`);
    const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<never>;
    if (!result.ok) throw new Error(result.error);
    return result.value;
  },
  send(channel, ...args) {
    if (!sendChannels.has(channel)) throw new Error(`Blocked IPC channel: ${channel}`);
    ipcRenderer.send(channel, ...args);
  },
  on(channel, listener) {
    if (!eventChannels.has(channel)) throw new Error(`Blocked IPC channel: ${channel}`);
    const wrapped = (_event: Electron.IpcRendererEvent, payload: unknown) =>
      listener(payload as never);
    ipcRenderer.on(channel, wrapped);
    return () => {
      ipcRenderer.removeListener(channel, wrapped);
    };
  },
  platform: process.platform,
};

contextBridge.exposeInMainWorld("codeforge", bridge);
