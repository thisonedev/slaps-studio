import { pageTitle } from '@studio/constants';
import { SettingsPage } from '@studio/ui';

export const metadata = {
  title: pageTitle('Settings'),
};

export default function Page() {
  return <SettingsPage />;
}

export const dynamic = 'force-static';
