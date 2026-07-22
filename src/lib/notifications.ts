import { db, collection, addDoc, doc, updateDoc, arrayUnion } from './firebase';
import type { NotificationType } from '../types';

interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  actorName: string;
  actorEmail: string;
  entityType: 'project' | 'asset' | 'maintenance';
  entityId: string;
}

/**
 * Records an activity notification for the admin feed.
 *
 * Deliberately fire-and-forget: a notification failing must never roll back or
 * block the action the student actually took. Failures are logged, not surfaced.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await addDoc(collection(db, 'notifications'), {
      ...input,
      createdAt: new Date().toISOString(),
      readBy: [],
    });
  } catch (err) {
    console.error('Could not write notification:', err);
  }
}

/** Read state is per-admin, so "read" means "this email is in readBy". */
export async function markNotificationRead(id: string, email: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', id), { readBy: arrayUnion(email) });
  } catch (err) {
    console.error('Could not mark notification read:', err);
  }
}

export const NOTIFICATION_META: Record<NotificationType, { label: string; tone: string; dot: string }> = {
  project_submitted: { label: 'Awaiting approval', tone: 'text-[#a86500]', dot: 'bg-[#ff9f0a]' },
  project_updated:   { label: 'Project updated',   tone: 'text-[#0071e3]', dot: 'bg-[#0071e3]' },
  project_approved:  { label: 'Approved',          tone: 'text-[#1a7f37]', dot: 'bg-[#34c759]' },
  project_rejected:  { label: 'Changes requested', tone: 'text-[#c9302c]', dot: 'bg-[#ff3b30]' },
  asset_checked_out: { label: 'Checked out',       tone: 'text-[#0071e3]', dot: 'bg-[#0071e3]' },
  asset_returned:    { label: 'Returned',          tone: 'text-[#1a7f37]', dot: 'bg-[#34c759]' },
  maintenance_logged:{ label: 'Maintenance',       tone: 'text-[#6e6e73]', dot: 'bg-[#86868b]' },
};
