
export function normalizeNamibianPhone(input: string){
    let s = String(input).replace(/[^0-9]/g, "");
    if (s.startsWith("+")) s = s.slice(1);
    if (s.startsWith("264")) return s;
    if (s.startsWith("0")) s = s.slice(1);
    return `264${s}`
}
