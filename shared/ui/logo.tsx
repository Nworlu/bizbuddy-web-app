export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const mark = { sm: "size-7 rounded-lg text-sm", md: "size-8 rounded-lg text-sm", lg: "size-16 rounded-2xl text-3xl" }[size];
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden="true" className={`flex items-center justify-center bg-brand-700 font-bold text-white ${mark}`}>
        ₦
      </span>
      {size !== "lg" && <span className="text-lg font-extrabold tracking-tight text-ink">BizBuddy</span>}
    </span>
  );
}
