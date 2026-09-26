import { isAdmin } from '@/lib/auth';
import { mailConfigured, sendMail } from '@/lib/mail';
import { approvePayment, listPayments, membersOverview, rejectPayment, renewMember, reopenPayment, resetMemberPassword, setMemberActive, type Member } from '@/lib/members';
import { deleteUser, findUserByEmail, usersOverview } from '@/lib/users';

const overview = () => ({ ...membersOverview(), users: usersOverview() });

// Owner-only: review UPI payments, manage member accounts, and see free (resume builder) accounts.
export async function GET() {
  if (!(await isAdmin())) return Response.json({ error: 'Not signed in' }, { status: 401 });
  return Response.json({ ...overview(), mail: mailConfigured() });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: 'Not signed in' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const origin = new URL(request.url).origin;
  try {
    switch (body.action) {
      case 'approve': {
        // Someone who already has a free account keeps its sign-in (and saved resume) when they become a member.
        const free = findUserByEmail(listPayments().find((p) => p.id === String(body.id))?.email || '');
        const { member, password, created } = approvePayment(String(body.id), free && { uid: free.id, salt: free.salt, hash: free.hash });
        if (created && free) deleteUser(free.id, true);
        const message = welcomeMessage(origin, member, password, created);
        const emailed = await sendMail(member.email, created ? 'Your ReuseMe portfolio is ready' : 'Your ReuseMe membership is renewed', message).catch(() => false);
        return Response.json({ ...overview(), result: { email: member.email, slug: member.slug, password, created, message, emailed } });
      }
      case 'reject':
        rejectPayment(String(body.id));
        break;
      case 'reopen':
        reopenPayment(String(body.id));
        break;
      case 'renew':
        renewMember(String(body.slug), body.plan === 'yearly' ? 'yearly' : 'monthly');
        break;
      case 'toggle':
        setMemberActive(String(body.slug), Boolean(body.active));
        break;
      case 'delete-user':
        deleteUser(String(body.id));
        break;
      case 'reset': {
        const { member, password } = resetMemberPassword(String(body.slug));
        const message = welcomeMessage(origin, member, password, false);
        const emailed = await sendMail(member.email, 'Your new ReuseMe password', message).catch(() => false);
        return Response.json({ ...overview(), result: { email: member.email, slug: member.slug, password, message, emailed } });
      }
      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
    return Response.json(overview());
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

function welcomeMessage(origin: string, m: Member, password: string | null, created: boolean) {
  const until = new Date(m.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  return [
    `Hi ${m.name.split(' ')[0]},`,
    '',
    created ? 'Your ReuseMe portfolio website is ready!' : password ? 'Here is your new ReuseMe password.' : 'Your ReuseMe membership has been renewed.',
    '',
    `Your website: ${origin}/${m.slug}`,
    `Edit it here: ${origin}/admin`,
    `Email: ${m.email}`,
    ...(password
      ? [`Password: ${password}`, '', 'Please change your password after signing in: More → Account & password.']
      : created
        ? ['Sign in the same way you already do (Google, email code or your password). If you were signed in, you still are.']
        : []),
    '',
    'Tip: on the sign-in page you can also tap "Continue with Google" or "Email code" with this Gmail, no password needed.',
    '',
    `Plan: ${m.plan === 'yearly' ? 'Yearly' : 'Monthly'} · active until ${until}`,
    '',
    'Thanks for joining ReuseMe!',
  ].join('\n');
}
