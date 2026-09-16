import LoginForm from './LoginForm';
import { title } from '@/app/_prototype/login/meta';
import '@/app/_prototype/login/page.css';

export const metadata = { title };

/**
 * The prototype's login markup, with the form half replaced by real auth.
 * The photo half is static, so it stays verbatim.
 *
 * The prototype had a separate "admin sign-in" link; with real accounts there
 * is one sign-in and role decides where you land, so that link is gone.
 */
export default function Page() {
  return (
    <div className="pg-login">
      <div className="login">
        <div className="photo">
          <img src="/photography/01-hero/cdl-hero-02-terminal-yard-fog.jpg" alt="" />
          <img className="logo" src="/logo/official/cdl-logo-light-for-dark-bg.png" alt="Customs Data Lock" />
          <div className="cap">
            <h2>
              Your supply chain is public.
              <br />
              Your account <em>is not.</em>
            </h2>
            <p>Reports, names, renewals. Everything we hold for you, in one place.</p>
          </div>
        </div>
        <div className="pane">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
