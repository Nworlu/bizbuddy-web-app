/** First letter of the name. Amber while they owe, green when paid up. Decorative: the balance is always written out too. */
export function CustomerAvatar({ name, owing, size = "md" }: { name: string; owing: boolean; size?: "md" | "lg" }) {
  const box = size === "lg" ? "size-14 rounded-2xl text-xl" : "size-11 rounded-full text-base";
  const tone = owing ? "bg-amber-100 text-amber-800" : "bg-brand-100 text-brand-800";
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center font-bold ${box} ${tone}`}>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
