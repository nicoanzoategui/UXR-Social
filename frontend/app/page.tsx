import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const jar = await cookies();
  const token = jar.get("access_token");
  if (token?.value) {
    redirect("/dashboard");
  }
  redirect("/login");
}
