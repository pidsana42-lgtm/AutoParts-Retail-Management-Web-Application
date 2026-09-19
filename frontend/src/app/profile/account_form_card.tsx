import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/elements/card";
import { cn } from "../../utils/component";

type AccountFormCardProps = {
  className?: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
};

export default function AccountFormCard({ className, icon, title, subtitle, children }: AccountFormCardProps) {
  return (
    <Card className={cn("border border-gray-200 border-l-4 border-l-[#E51C23] bg-white shadow-sm", className)}>
      <CardHeader className="border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center bg-red-50 text-[#B70011]">{icon}</span>
          <div>
            <CardTitle className="text-xl font-normal text-[#1C1B1B]">{title}</CardTitle>
            <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 sm:p-6">{children}</CardContent>
    </Card>
  );
}
