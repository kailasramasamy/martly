import { Button, Tooltip, Typography } from "antd";
import dayjs from "dayjs";
import { AI_IMAGES_LOW_SHARE } from "@martly/shared/constants";
import type { AiImageUsageData } from "../../hooks/use-ai-images";

const { Text } = Typography;

interface AiImageUsageProps {
  usage: AiImageUsageData | null;
  /** Images this action uses */
  cost: number;
  /** Shown when the cost is only an upper bound, e.g. "up to" */
  upTo?: boolean;
  note?: string;
  onBuy: () => void;
}

function tooltipFor(u: AiImageUsageData) {
  const reset = u.resetsAt ? ` (resets ${dayjs(u.resetsAt).format("D MMM")})` : "";
  return `${u.planLeft} of ${u.total} plan images left this month${reset} + ${u.packBalance} from packs`;
}

/** "Uses N AI images · X left" beside a generate button; amber when running low, red when there are too few */
export function AiImageUsage({ usage, cost, upTo, note, onBuy }: AiImageUsageProps) {
  if (!usage) return null;
  const empty = usage.left < cost;
  const low = !empty && (usage.left / Math.max(usage.total, 1) <= AI_IMAGES_LOW_SHARE || usage.left < 2 * cost);
  const type = empty ? "danger" : "secondary";
  return (
    <Text type={type} style={low ? { color: "#d97706" } : undefined}>
      <Tooltip title={tooltipFor(usage)}>
        Uses {upTo && "up to "}{cost} AI {cost === 1 ? "image" : "images"} · {usage.left} left
      </Tooltip>
      {note && ` · ${note}`}
      {(low || empty) && <Button type="link" size="small" onClick={onBuy}>Buy more</Button>}
    </Text>
  );
}
