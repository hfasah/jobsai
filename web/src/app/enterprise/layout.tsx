import { EnterpriseShell } from "@/components/enterprise/enterprise-shell";

export default function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  return <EnterpriseShell>{children}</EnterpriseShell>;
}
