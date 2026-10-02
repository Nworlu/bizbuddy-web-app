import Image from "next/image";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const px = { sm: 28, md: 32, lg: 64 }[size];
  return (
    <span className="flex items-center gap-2.5">
      <Image src="/logo.png" alt={size === "lg" ? "BizBuddy" : ""} width={px} height={px} className={`${size === "lg" ? "rounded-2xl" : "rounded-lg"} object-cover`} style={{ width: px, height: px }} />
      {size !== "lg" && <span className="text-lg font-extrabold tracking-tight text-ink">BizBuddy</span>}
    </span>
  );
}
