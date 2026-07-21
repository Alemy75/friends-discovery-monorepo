import type { ReactNode } from 'react';
import { Card } from '../ui/card';

function LegalPageLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[640px]">
        <Card>
          <h1 className="text-2xl font-geist font-medium text-ink">{title}</h1>
          <p className="mt-3 inline-block rounded-pill bg-accent-soft px-3 py-1 text-xs font-geist font-medium text-accent-ink">
            Черновик — финальный текст готовится.
          </p>
          {children}
        </Card>
      </div>
    </div>
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Политика обработки персональных данных">
      <p className="mt-4 font-geist text-mid-gray">
        Здесь появится итоговый текст политики обработки персональных данных, согласованный с юридической
        командой.
      </p>
    </LegalPageLayout>
  );
}

export function TermsPage() {
  return (
    <LegalPageLayout title="Пользовательское соглашение">
      <p className="mt-4 font-geist text-mid-gray">
        Здесь появится итоговый текст пользовательского соглашения, согласованный с юридической командой.
      </p>
    </LegalPageLayout>
  );
}
