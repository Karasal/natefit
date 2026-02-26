import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Manage your account and preferences." />
      <Card className="max-w-lg">
        <div className="flex flex-col items-center py-8 text-center">
          <Settings className="h-8 w-8 text-text-dim mb-3" />
          <p className="text-sm text-text-dim">Settings coming soon.</p>
        </div>
      </Card>
    </>
  );
}
