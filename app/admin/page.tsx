import { redirect } from 'next/navigation';
import { getOperator } from '@/lib/admin/auth';
import { getAdminContent } from '@/lib/admin/read';
import AdminApp from '@/components/admin/AdminApp';

// Server-rendered gate: middleware already protects /admin, but we re-check the
// operator here (defense-in-depth + to resolve identity) and load the live content
// store to seed the client controller. Never prerendered.
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const operator = await getOperator();
  if (!operator) redirect('/admin/sign-in');

  const { content } = await getAdminContent();

  return (
    <AdminApp
      initialContent={content}
      operator={{ name: operator.name, email: operator.email }}
    />
  );
}
