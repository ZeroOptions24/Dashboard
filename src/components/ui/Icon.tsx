import { ICONS, type IconName } from "@/lib/icons";

export default function Icon({ name, small }: { name: IconName; small?: boolean }) {
  return (
    <svg className={small ? "ico sm" : "ico"} viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}
