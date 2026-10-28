// Đăng ký nền tảng theo mã (D-28). Thêm nền tảng mới = viết một Platform + registerPlatform(), không sửa nghiệp vụ.
// Nguồn dữ liệu chọn theo Connection.mode: "replay" đọc fixtures/replay/<mã shop>.json, "live" gọi API thật (Phase 12).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { HttpError } from "@/lib/errors";
import { pancake } from "./pancake";
import { shopify } from "./shopify";
import type { Platform, RawEvent } from "./types";

const platforms = new Map<string, Platform>([pancake, shopify].map((p) => [p.code, p]));

export function registerPlatform(p: Platform) {
  platforms.set(p.code, p);
}
export function getPlatform(code: string): Platform {
  const p = platforms.get(code);
  if (!p) throw new HttpError(400, `Chưa có adapter cho nền tảng "${code}". Đăng ký adapter trước khi tạo kết nối.`);
  return p;
}
export const listPlatforms = () => [...platforms.values()];

export type Source = { fetch(since: Date | null, until: Date): Promise<RawEvent[]> };

/** Thư mục fixture phát lại; test đổi qua REPLAY_DIR. */
const replayDir = () => process.env.REPLAY_DIR || path.join(process.cwd(), "fixtures", "replay");

function replaySource(storeCode: string): Source {
  return {
    async fetch(since, until) {
      let text: string;
      try {
        text = await readFile(path.join(replayDir(), `${storeCode}.json`), "utf8");
      } catch {
        return [];
      }
      const all = JSON.parse(text) as { visibleAt: string; record: unknown }[];
      return all
        .map((e) => ({ visibleAt: new Date(e.visibleAt), record: e.record }))
        .filter((e) => (!since || e.visibleAt > since) && e.visibleAt <= until)
        .sort((a, b) => a.visibleAt.getTime() - b.visibleAt.getTime());
    },
  };
}

function liveSource(platform: Platform): Source {
  return {
    async fetch() {
      // Không bịa endpoint: API thật chưa xác minh (docs/integrations.md). Phase 12 cài đặt theo tài liệu đã đối chiếu.
      throw new HttpError(501, `Kết nối thật tới ${platform.label} chưa bật (mức xác minh ${platform.verification}). Dùng chế độ phát lại cho demo.`);
    },
  };
}

export function sourceFor(conn: { mode: string; platform: string }, storeCode: string): Source {
  const platform = getPlatform(conn.platform);
  return conn.mode === "live" ? liveSource(platform) : replaySource(storeCode);
}
