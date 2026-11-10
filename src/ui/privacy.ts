export const FOOTNOTE = `<p class="fine">What you enter never leaves this tab. Close it and it is gone. <button type="button" class="quiet is-line is-small" data-action="policy" data-key="policy">Privacy policy</button></p>`

export function privacyPolicy(back: boolean): string {
  return `<h1 tabindex="-1">Privacy policy</h1>
  <p class="lede">We do not collect, store, or share any data about you. Dragon Credit Map runs entirely in your browser.</p>
  <div class="prose">
    <h2>What we collect</h2>
    <p>Nothing. There are no accounts, no sign-in, no analytics, no advertising, and no tracking of any kind.</p>
    <h2>Your transcript</h2>
    <p>When you choose or paste a transcript, it is read inside this browser tab. It is never uploaded, never sent to us or to anyone else, and never saved to your device by this site.</p>
    <p>The reader looks only for course rows and AP scores. It is built to skip your name, student number, date of birth, address, GPA, and class rank, and it does not keep or send them. Lines it could not match to a course are shown to you once so you can check them, then thrown away.</p>
    <p>After you confirm what was read, only your campus, class year, course codes, grades, and AP scores are kept, and only in this tab's memory.</p>
    <h2>What you enter</h2>
    <p>Your campus, class year, university, major, courses, grades, and AP scores stay in this tab's memory. They are gone when you close or reload the tab. We have no copy.</p>
    <h2>Cookies and storage</h2>
    <p>This site sets no cookies and does not use local storage, session storage, or any other browser storage.</p>
    <h2>Other companies</h2>
    <p>This site loads nothing from other companies. Its fonts and every other file come from the same place as the page itself, and after the page has loaded it makes no further network requests except for its own files.</p>
    <p>The service that hosts these files may keep ordinary server logs, as any web host does: your IP address, the time, and which of this site's files your browser asked for. Because some data is split into separate files, those logs can show which university you picked, whether you picked a major at all, and whether you opened a PDF. They never show which major, or your courses, grades, scores, or transcript.</p>
    <h2>Links to sources</h2>
    <p>Source links open pages run by NCSSM, UNC-Chapel Hill, NC State, and Google. Those sites have their own privacy practices. This site does not tell them which page you came from.</p>
    <h2>Requests and deletion</h2>
    <p>Because we hold no data about you, there is nothing for us to show you, correct, or delete. To clear everything, close this tab.</p>
    <h2>Who runs this</h2>
    <p>Dragon Credit Map is an unofficial tool. It is not run by or affiliated with NCSSM, UNC-Chapel Hill, or NC State.</p>
    <p class="hint">Last updated November 2026.</p>
  </div>
  ${back ? `<div class="bar is-static"><button type="button" class="back" data-action="policy-close" data-key="policy-close">Back</button></div>` : ""}`
}
