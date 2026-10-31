import Link from "next/link";

export interface DocPage {
  slug: string;
  title: string;
  description: string;
  section: "Start" | "Using CodeForge" | "Reference" | "Help";
  body: React.ReactNode;
}

const K = ({ children }: { children: React.ReactNode }) => <kbd>{children}</kbd>;

export const DOCS: DocPage[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    description: "Open your first project and learn the parts of the CodeForge window.",
    section: "Start",
    body: (
      <>
        <p>
          This guide takes you from a fresh install to editing, running and committing code in a few
          minutes.
        </p>
        <h2>1. Open a folder</h2>
        <p>
          CodeForge works on folders on your computer. On the Welcome page choose{" "}
          <strong>Open Folder…</strong> (or <em>File → Open Folder…</em>) and pick your project. The
          folder appears in the <strong>Explorer</strong> on the left, and CodeForge reopens it
          automatically next time.
        </p>
        <h2>2. The window at a glance</h2>
        <ul>
          <li>
            <strong>Activity bar</strong> (far left): switch between Explorer, Search, Source
            Control and Run. Click the active icon again to hide the side bar.
          </li>
          <li>
            <strong>Editor</strong> (center): your open files as tabs. A dot on a tab means it has
            unsaved changes.
          </li>
          <li>
            <strong>Panel</strong> (bottom): the Terminal, Problems and Output. Toggle it with{" "}
            <K>Ctrl+J</K>.
          </li>
          <li>
            <strong>Status bar</strong> (bottom): Git branch, errors and warnings, cursor position,
            indentation, encoding and language.
          </li>
          <li>
            <strong>Command center</strong> (top): click it or press <K>Ctrl+P</K> to jump to any
            file.
          </li>
        </ul>
        <h2>3. Edit and save</h2>
        <p>
          Click a file in the Explorer to open it, start typing, and press <K>Ctrl+S</K> to save.
          Turn on <em>File → Toggle Auto Save</em> if you&apos;d rather never think about saving.
        </p>
        <h2>4. Use the terminal</h2>
        <p>
          Press <K>Ctrl+`</K> to open a terminal in your project folder. It&apos;s a real PowerShell
          (or the shell you configure), so commands like <code>npm install</code> or{" "}
          <code>python app.py</code> work exactly as usual.
        </p>
        <h2>5. Find anything</h2>
        <p>
          <K>Ctrl+Shift+P</K> opens the <strong>Command Palette</strong> with every action in
          CodeForge. <K>Ctrl+Shift+F</K> searches text across all files.
        </p>
        <p>
          Next, read about the <Link href="/docs/editor">editor</Link>, the{" "}
          <Link href="/docs/terminal">terminal</Link> and{" "}
          <Link href="/docs/source-control">source control</Link>.
        </p>
      </>
    ),
  },
  {
    slug: "installation",
    title: "Installation",
    description: "Install, update and uninstall CodeForge on Windows.",
    section: "Start",
    body: (
      <>
        <h2>Install on Windows</h2>
        <ol>
          <li>
            Download <code>CodeForge-Setup-&lt;version&gt;-x64.exe</code> from the{" "}
            <Link href="/download">download page</Link>.
          </li>
          <li>
            Optional: verify the file. In PowerShell run{" "}
            <code>Get-FileHash .\CodeForge-Setup-&lt;version&gt;-x64.exe</code> and compare the hash
            with the SHA-256 shown on the download page.
          </li>
          <li>
            Run the installer. Because early releases are not code-signed, Windows SmartScreen may
            say <em>“Windows protected your PC”</em>. Click <strong>More info → Run anyway</strong>.
          </li>
          <li>
            Choose the install location (your user profile by default — no administrator rights
            needed) and finish.
          </li>
          <li>Start CodeForge from the Start menu or the desktop shortcut.</li>
        </ol>
        <h2>Update</h2>
        <p>
          CodeForge 0.2.0 and later update themselves. When a new version is published, CodeForge
          downloads it in the background and shows <strong>Restart Now</strong> /{" "}
          <strong>Later</strong>; if you just quit, the update installs on exit. Use{" "}
          <em>Help → Check for Updates…</em> to check right away, or turn automatic checks off in
          Settings (<code>update.checkOnStartup</code>).
        </p>
        <p>
          Coming from 0.1.1? That version has no updater: download the latest installer from the{" "}
          <Link href="/download">download page</Link> once and run it — it replaces the old version
          and keeps your settings.
        </p>
        <h2>Uninstall</h2>
        <p>
          Open <em>Settings → Apps → Installed apps</em>, find CodeForge and choose{" "}
          <strong>Uninstall</strong>. Your settings in <code>%APPDATA%\CodeForge</code> are kept in
          case you reinstall; delete that folder to remove them too.
        </p>
        <h2>Requirements</h2>
        <p>
          Windows 10 version 1809 or later (or Windows 11), 64-bit. Install{" "}
          <a href="https://git-scm.com/downloads">Git</a> to use source control, and the runtimes
          for the languages you want to run (Node.js, Python, …).
        </p>
      </>
    ),
  },
  {
    slug: "editor",
    title: "Editing code",
    description: "Tabs, saving, find and replace, multiple cursors and more.",
    section: "Using CodeForge",
    body: (
      <>
        <p>
          CodeForge uses <strong>Monaco</strong>, the editing component behind Visual Studio Code,
          so editing behaves the way you expect.
        </p>
        <h2>Tabs and saving</h2>
        <ul>
          <li>
            Each open file gets a tab. A dot means unsaved changes; undoing back to the saved text
            clears it.
          </li>
          <li>
            <K>Ctrl+S</K> saves, <K>Ctrl+Shift+S</K> saves as, <K>Ctrl+Alt+S</K> saves all.{" "}
            <K>Ctrl+N</K> creates an untitled file.
          </li>
          <li>
            <K>Ctrl+W</K> closes a tab; middle-click works too. If the file has unsaved changes
            CodeForge asks whether to save.
          </li>
          <li>
            <K>Ctrl+Tab</K> / <K>Ctrl+Shift+Tab</K> cycle through tabs.
          </li>
          <li>Closing the window or switching folders also asks before discarding unsaved work.</li>
        </ul>
        <h2>Auto Save</h2>
        <p>
          Auto Save is on by default: a file is saved one second after you stop typing, so you
          rarely need <K>Ctrl+S</K>. The status bar shows <strong>Saving…</strong>,{" "}
          <strong>Saved</strong>, <strong>● Unsaved</strong> or <strong>Save failed</strong> for the
          file you are editing. Click <strong>Auto Save: On</strong> in the status bar (or use{" "}
          <em>File → Auto Save</em>) to switch it off; change the delay with the{" "}
          <code>files.autoSaveDelay</code> setting.
        </p>
        <ul>
          <li>Untitled files are never auto saved — save them once with a name first.</li>
          <li>
            If a save fails (for example the file is read-only), your changes stay in the editor, a
            single notification explains why and offers <strong>Retry</strong>, and Auto Save tries
            again after your next edit — it doesn&apos;t retry in a loop.
          </li>
          <li>
            If another program changed the file, Auto Save doesn&apos;t overwrite it; press{" "}
            <K>Ctrl+S</K> to decide.
          </li>
        </ul>
        <h2>File icons and languages</h2>
        <p>
          Files show the icon of their language (Python, JavaScript, HTML, CSS, JSON, Java, C++, Go,
          Rust and many more) in the Explorer, tabs, Go to File, search results and Problems. The
          icon and the syntax highlighting follow the file name, so renaming <code>test.txt</code>{" "}
          to <code>test.py</code> turns it into a Python file. Click the language name in the status
          bar to change a file&apos;s language manually.
        </p>
        <h2>Changes made outside CodeForge</h2>
        <p>
          If a file you have open (without unsaved changes) is modified by another program — for
          example by <code>git checkout</code> — CodeForge reloads it automatically. If you have
          unsaved changes and the file on disk changed, saving asks before overwriting.
        </p>
        <h2>Editing power tools</h2>
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Shortcut</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Find / Replace in file</td>
              <td>
                <K>Ctrl+F</K> / <K>Ctrl+H</K>
              </td>
            </tr>
            <tr>
              <td>Add cursor above / below</td>
              <td>
                <K>Ctrl+Alt+Up</K> / <K>Ctrl+Alt+Down</K>
              </td>
            </tr>
            <tr>
              <td>Add cursor anywhere</td>
              <td>
                <K>Alt+Click</K>
              </td>
            </tr>
            <tr>
              <td>Select all occurrences</td>
              <td>
                <K>Ctrl+Shift+L</K>
              </td>
            </tr>
            <tr>
              <td>Toggle line comment</td>
              <td>
                <K>Ctrl+/</K>
              </td>
            </tr>
            <tr>
              <td>Format document</td>
              <td>
                <K>Shift+Alt+F</K>
              </td>
            </tr>
            <tr>
              <td>Go to line</td>
              <td>
                <K>Ctrl+G</K>
              </td>
            </tr>
            <tr>
              <td>Fold / unfold region</td>
              <td>
                <K>Ctrl+Shift+[</K> / <K>Ctrl+Shift+]</K>
              </td>
            </tr>
            <tr>
              <td>Toggle word wrap</td>
              <td>
                <K>Alt+Z</K>
              </td>
            </tr>
            <tr>
              <td>Select line / expand / shrink selection</td>
              <td>
                <K>Ctrl+L</K> / <K>Shift+Alt+Right</K> / <K>Shift+Alt+Left</K>
              </td>
            </tr>
            <tr>
              <td>Zoom the window in / out / reset</td>
              <td>
                <K>Ctrl+=</K> / <K>Ctrl+-</K> / <K>Ctrl+0</K>
              </td>
            </tr>
          </tbody>
        </table>
        <h2>Encodings and file limits</h2>
        <ul>
          <li>
            Files are read and written as UTF-8. A UTF-8 byte-order mark is preserved, and line
            endings (LF or CRLF) are kept.
          </li>
          <li>Binary files (images, archives, …) are not opened in the editor.</li>
          <li>Files larger than 50 MB are not opened, to keep the editor responsive.</li>
        </ul>
      </>
    ),
  },
  {
    slug: "explorer",
    title: "Working with files",
    description: "Create, rename, move and delete files and folders.",
    section: "Using CodeForge",
    body: (
      <>
        <h2>Create</h2>
        <p>
          Use the <strong>New File</strong> and <strong>New Folder</strong> buttons in the Explorer
          header or right-click a folder. Type a name and press <K>Enter</K>. You can type a path
          such as <code>src/utils/math.ts</code> to create the folders along the way.
        </p>
        <h2>Rename and move</h2>
        <p>
          Select an item and press <K>F2</K> (or right-click → Rename). Drag files and folders onto
          another folder to move them. Open tabs follow the file, unsaved changes included.
          CodeForge never overwrites an existing file when renaming or moving.
        </p>
        <h2>Delete</h2>
        <p>
          Press <K>Delete</K> or right-click → Delete. After you confirm, the item goes to the{" "}
          <strong>Recycle Bin</strong>, so you can restore it from Windows.
        </p>
        <h2>Keyboard navigation</h2>
        <p>
          A single click opens a file while keeping focus in the Explorer, so <K>Up</K>/<K>Down</K>,{" "}
          <K>Left</K>/<K>Right</K>, <K>Enter</K>, <K>F2</K> and <K>Delete</K> keep working.
          Double-click a file to jump into the editor.
        </p>
        <h2>More actions</h2>
        <ul>
          <li>Reveal in File Explorer, Copy Path and Copy Relative Path from the context menu.</li>
          <li>Open in Integrated Terminal starts a terminal in that folder.</li>
          <li>Git status colors: green for new files, amber for modified, red for deleted.</li>
          <li>
            Hide files with the <code>files.exclude</code> setting (by default <code>.git</code>,{" "}
            <code>.DS_Store</code> and <code>Thumbs.db</code>).
          </li>
        </ul>
      </>
    ),
  },
  {
    slug: "search",
    title: "Search",
    description: "Find files by name and text across your whole project.",
    section: "Using CodeForge",
    body: (
      <>
        <h2>Go to File</h2>
        <p>
          Press <K>Ctrl+P</K> and type part of a file name — letters don&apos;t need to be
          consecutive, so <code>btn</code> finds <code>Button.tsx</code>. Type <code>&gt;</code> to
          switch to commands, or <code>:</code> followed by a number to go to a line.
        </p>
        <h2>Find in Files</h2>
        <p>
          Press <K>Ctrl+Shift+F</K>. Results are grouped by file; click a result to open the file
          with the match selected. The toggles on the right of the search box enable{" "}
          <strong>match case</strong>, <strong>whole word</strong> and{" "}
          <strong>regular expressions</strong>.
        </p>
        <h2>Include and exclude</h2>
        <p>
          Open <em>Files to include / exclude</em> and enter comma-separated patterns: a name like{" "}
          <code>src</code> limits the search to that folder, <code>*.ts</code> to a file type, and{" "}
          <code>src/**/*.test.ts</code> to a path pattern. Folders such as <code>node_modules</code>
          , <code>dist</code> and <code>.next</code> are always skipped — change that with the{" "}
          <code>search.exclude</code> setting.
        </p>
        <h2>Replace across files</h2>
        <p>
          Click the arrow left of the search box to show the <strong>Replace</strong> field. Each
          result previews the change (old text struck through, new text in green). Use the{" "}
          <strong>Replace All</strong> button (or <K>Ctrl+Enter</K>) for every result, or the button
          on a file to replace only there. CodeForge asks before replacing.
        </p>
        <ul>
          <li>
            Files open in the editor are changed in the editor, so <K>Ctrl+Z</K> undoes the
            replacement and you decide when to save. Other files are changed on disk.
          </li>
          <li>
            With regular expressions on, the replacement can use <code>$1</code>,{" "}
            <code>$&lt;name&gt;</code> and <code>$&amp;</code> (the whole match); <code>$$</code>{" "}
            inserts a dollar sign. Without regular expressions the text is inserted exactly as
            typed.
          </li>
          <li>Search results include unsaved changes in open files.</li>
        </ul>
        <h2>Limits</h2>
        <p>
          Search stops after 5,000 matches and skips binary files and files over 2 MB. Regular
          expressions match within a line.
        </p>
      </>
    ),
  },
  {
    slug: "terminal",
    title: "Integrated terminal",
    description: "Run real shell commands without leaving the editor.",
    section: "Using CodeForge",
    body: (
      <>
        <p>
          The integrated terminal runs real shell processes through a pseudo-terminal (ConPTY on
          Windows). Anything that works in a normal terminal window works here, including
          interactive programs and colored output.
        </p>
        <h2>Basics</h2>
        <ul>
          <li>
            <K>Ctrl+`</K> shows or hides the terminal; <K>Ctrl+Shift+`</K> opens a new one.
          </li>
          <li>New terminals start in the open folder (or the folder you right-clicked).</li>
          <li>
            With several terminals open, a list on the right lets you switch between them or kill
            one.
          </li>
          <li>
            <K>Ctrl+C</K> copies when text is selected and otherwise interrupts the running program.{" "}
            <K>Ctrl+V</K> pastes.
          </li>
        </ul>
        <h2>Split terminals</h2>
        <p>
          Click the split button in the terminal toolbar or press <K>Ctrl+Shift+5</K> to open
          another terminal next to the current one (up to four side by side). Click a pane to type
          in it; the list on the right shows split terminals grouped together.
        </p>
        <h2>Choosing a shell</h2>
        <p>
          New terminals use Windows PowerShell by default.{" "}
          <em>Terminal → New Terminal With Profile…</em> (or the arrow next to <strong>+</strong> in
          the terminal toolbar) starts any shell CodeForge found on your computer:{" "}
          <strong>PowerShell</strong>, <strong>Command Prompt</strong>, and{" "}
          <strong>PowerShell 7</strong> and <strong>Git Bash</strong> when they are installed. The
          terminal list shows which shell each terminal runs.
        </p>
        <h2>Terminal menu</h2>
        <p>
          <em>New Terminal</em>, <em>Split Terminal</em>, <em>Clear Terminal</em> (clears the screen
          and scrollback) and <em>Close Terminal</em> (ends the shell) act on the active terminal.
        </p>
        <h2>Default and custom shells</h2>
        <p>
          Pick a <strong>Default terminal</strong> in Settings. To use any other shell program,
          enter its full path in <strong>Custom shell path</strong> (<code>terminal.shell</code>),
          for example:
        </p>
        <pre>
          <code>{`cmd.exe
pwsh.exe
C:\\Program Files\\Git\\bin\\bash.exe`}</code>
        </pre>
        <p>The setting applies to terminals you open afterwards.</p>
      </>
    ),
  },
  {
    slug: "source-control",
    title: "Source control (Git)",
    description: "Stage, commit, diff, branch, pull and push with Git.",
    section: "Using CodeForge",
    body: (
      <>
        <p>
          CodeForge uses the Git installed on your computer, so it works with your existing
          configuration, credentials and repositories. Install Git from{" "}
          <a href="https://git-scm.com/downloads">git-scm.com</a> if you don&apos;t have it.
        </p>
        <h2>Start</h2>
        <p>
          Open the Source Control view with <K>Ctrl+Shift+G</K>. If the folder isn&apos;t a
          repository yet, click <strong>Initialize Repository</strong>.
        </p>
        <h2>Review and stage</h2>
        <ul>
          <li>
            <strong>Changes</strong> lists modified, new and deleted files;{" "}
            <strong>Staged Changes</strong> lists what the next commit will contain.
          </li>
          <li>Click a modified file to see a side-by-side diff.</li>
          <li>
            Hover a file for actions: <strong>+</strong> stages, <strong>−</strong> unstages, ↶
            discards changes (after confirmation; new files go to the Recycle Bin).
          </li>
        </ul>
        <h2>Commit</h2>
        <p>
          Type a message and press <strong>Commit</strong> or <K>Ctrl+Enter</K>. If nothing is
          staged, CodeForge offers to stage everything first. Git must know your name and email — if
          a commit fails, run <code>git config --global user.name &quot;Your Name&quot;</code> and{" "}
          <code>git config --global user.email you@example.com</code> in the terminal.
        </p>
        <h2>Branches and remotes</h2>
        <ul>
          <li>Click the branch name in the status bar to switch branches or create a new one.</li>
          <li>
            Use the pull and push buttons in the Source Control header. A branch without an upstream
            is pushed to <code>origin</code> and tracked automatically.
          </li>
          <li>
            Sign-in is handled by Git (Git Credential Manager on Windows shows its own window when
            needed).
          </li>
        </ul>
      </>
    ),
  },
  {
    slug: "run-and-preview",
    title: "Run & preview",
    description: "Run files and npm scripts, and preview web pages.",
    section: "Using CodeForge",
    body: (
      <>
        <h2>Run the current file</h2>
        <p>
          Choose <em>Run → Run Current File</em>, press <K>Ctrl+F5</K> or use the Run and Debug view
          (<K>Ctrl+Shift+D</K>). CodeForge saves the file and runs it in its own terminal, which
          shows the command, the program&apos;s output (you can type input too) and its exit code
          when it ends. Running the same file again replaces the previous run.
        </p>
        <table>
          <thead>
            <tr>
              <th>File type</th>
              <th>Command</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>JavaScript</td>
              <td>
                <code>node file.js</code>
              </td>
            </tr>
            <tr>
              <td>TypeScript</td>
              <td>
                <code>npx tsx file.ts</code>
              </td>
            </tr>
            <tr>
              <td>Python</td>
              <td>
                <code>python file.py</code>
              </td>
            </tr>
            <tr>
              <td>PowerShell</td>
              <td>
                <code>powershell -ExecutionPolicy Bypass -File file.ps1</code>
              </td>
            </tr>
            <tr>
              <td>Shell</td>
              <td>
                <code>bash file.sh</code>
              </td>
            </tr>
            <tr>
              <td>Java (JDK 11 or newer)</td>
              <td>
                <code>java Main.java</code>
              </td>
            </tr>
            <tr>
              <td>Ruby, PHP, Go, Lua, Dart</td>
              <td>
                <code>ruby</code>, <code>php</code>, <code>go run</code>, <code>lua</code>,{" "}
                <code>dart run</code>
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          The language runtime must be installed. CodeForge checks before running: if Python,
          Node.js or another runtime is missing, it tells you what to install and offers a download
          link instead of failing in the terminal. Files that need a build step first (C, C++, C#,
          Rust) get a short explanation of how to build them. HTML files open in the preview.
          Nothing runs unless you ask for it.
        </p>
        <h2>Stop a running program</h2>
        <p>
          <em>Run → Stop Running Program</em> (<K>Shift+F5</K>) sends <K>Ctrl+C</K> to the program
          and ends it if it is still running a moment later.
        </p>
        <h2>npm scripts</h2>
        <p>
          If the folder has a <code>package.json</code>, its scripts are listed in the Run view.
          Click one to run <code>npm run &lt;script&gt;</code> in a terminal.
        </p>
        <h2>Preview</h2>
        <ul>
          <li>
            <strong>HTML files:</strong> right-click an <code>.html</code> file → Open Preview, or
            use the Run view.
          </li>
          <li>
            <strong>Dev servers:</strong> start your server (for example <code>npm run dev</code>),
            then choose <em>Open Localhost Preview…</em> and enter its address, such as{" "}
            <code>http://localhost:3000</code>.
          </li>
        </ul>
        <p>
          Previews open in a separate sandboxed window with no access to your files or system, and
          links to other websites open in your browser.
        </p>
        <h2>Debugging</h2>
        <p>
          <em>Run → Start Debugging</em> (<K>F5</K>) starts the language&apos;s own debugger in a
          terminal: <code>python -m pdb</code> for Python files and <code>node inspect</code> for
          JavaScript files. The debugger stops at the first line; then type commands:
        </p>
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>pdb (Python)</th>
              <th>node inspect (JavaScript)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Next line / step into</td>
              <td>
                <code>n</code> / <code>s</code>
              </td>
              <td>
                <code>n</code> / <code>s</code>
              </td>
            </tr>
            <tr>
              <td>Continue</td>
              <td>
                <code>c</code>
              </td>
              <td>
                <code>c</code>
              </td>
            </tr>
            <tr>
              <td>Breakpoint at line 12</td>
              <td>
                <code>b 12</code>
              </td>
              <td>
                <code>setBreakpoint(12)</code>
              </td>
            </tr>
            <tr>
              <td>Show a variable</td>
              <td>
                <code>p name</code>
              </td>
              <td>
                <code>exec name</code>
              </td>
            </tr>
            <tr>
              <td>Quit</td>
              <td>
                <code>q</code>
              </td>
              <td>
                <code>.exit</code>
              </td>
            </tr>
          </tbody>
        </table>
        <p>Breakpoints in the editor gutter are not available yet.</p>
      </>
    ),
  },
  {
    slug: "languages",
    title: "Languages",
    description: "Which languages CodeForge highlights and understands.",
    section: "Reference",
    body: (
      <>
        <h2>Syntax highlighting</h2>
        <p>
          More than 70 file types are highlighted automatically, including JavaScript, TypeScript,
          JSX/TSX, JSON, HTML, CSS, SCSS, Less, Markdown, Python, Java, C, C++, C#, Go, Rust, Ruby,
          PHP, Swift, Kotlin, Dart, Lua, R, SQL, Shell, PowerShell, Batch, YAML, XML, TOML/INI,
          Dockerfile, GraphQL, Scala, Elixir, F#, Perl, Julia, Solidity and Protobuf.
        </p>
        <h2>Language intelligence</h2>
        <table>
          <thead>
            <tr>
              <th>Language</th>
              <th>What you get</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Python</td>
              <td>
                Completion, type errors, hover info, signature help, go to definition, references,
                rename (Pyright language server)
              </td>
            </tr>
            <tr>
              <td>TypeScript, JavaScript</td>
              <td>Completion, errors, hover info, go to definition, rename, formatting</td>
            </tr>
            <tr>
              <td>JSON</td>
              <td>Validation, completion, formatting</td>
            </tr>
            <tr>
              <td>CSS, SCSS, Less</td>
              <td>Validation, completion, hover, formatting</td>
            </tr>
            <tr>
              <td>HTML</td>
              <td>Tag and attribute completion, tag matching, formatting</td>
            </tr>
            <tr>
              <td>
                Java, C, C++, C#, Go, Rust, PHP, Ruby, SQL, Kotlin, Swift, Dart, Lua, R, Shell,
                PowerShell
              </td>
              <td>
                Keyword, built-in and snippet suggestions (for example <code>main</code>,{" "}
                <code>for</code>, <code>class</code>), plus words from your open files
              </td>
            </tr>
            <tr>
              <td>Everything else</td>
              <td>Highlighting, bracket matching, folding, word-based completion</td>
            </tr>
          </tbody>
        </table>
        <p>
          Suggestions appear while you type: use the arrow keys to choose, <K>Enter</K> or{" "}
          <K>Tab</K> to accept and <K>Esc</K> to close the list. <K>Ctrl+Space</K> opens it on
          demand.
        </p>
        <h2>Highlighting</h2>
        <p>
          Besides keywords, strings, numbers and comments, CodeForge colors function and method
          names, classes and types, parameters and properties in every supported language, and
          colors matching brackets.
        </p>
        <h2>Problems panel</h2>
        <p>
          <K>Ctrl+Shift+M</K> opens the Problems panel. It lists errors, warnings and notes from
          every checker — TypeScript/JavaScript, JSON, CSS, Python (Pyright) and CodeForge&apos;s
          own checks — grouped by file with line and column. Filter by severity or text, and click a
          problem to jump to it. CodeForge&apos;s own checks find:
        </p>
        <ul>
          <li>
            Code from another language, such as Python <code>print(…)</code> or <code>def …:</code>{" "}
            in an HTML page (browsers show it as text), JavaScript outside a{" "}
            <code>&lt;script&gt;</code> tag, JavaScript in a Python file, or Python in a JavaScript
            file. Code inside <code>&lt;script&gt;</code>, <code>&lt;style&gt;</code>,{" "}
            <code>&lt;pre&gt;</code>, <code>&lt;code&gt;</code> and comments, and ordinary
            sentences, are not reported.
          </li>
          <li>
            Unbalanced HTML: closing tags without an opening tag, and elements that are never closed
            (void elements like <code>&lt;br&gt;</code> and optional end tags like{" "}
            <code>&lt;p&gt;</code> and <code>&lt;li&gt;</code> are understood).
          </li>
        </ul>
        <h2>Current limitations</h2>
        <ul>
          <li>
            TypeScript and JavaScript intelligence covers every source file in the open folder (up
            to 400 files); types from <code>node_modules</code> are not loaded yet, so imports from
            packages are treated as untyped.
          </li>
          <li>
            Python IntelliSense starts the first time you open a <code>.py</code> file. It works
            with Python&apos;s standard library out of the box; to understand packages you installed
            with pip, install Python and make sure <code>python</code> works in a terminal. Turn it
            off with the <code>python.languageServer</code> setting.
          </li>
          <li>
            Full IntelliSense (types, go to definition) for Go, Rust, Java, C# and others needs
            their language servers, which are planned but not included yet.
          </li>
        </ul>
      </>
    ),
  },
  {
    slug: "settings",
    title: "Settings",
    description: "Customize the editor, terminal and appearance.",
    section: "Reference",
    body: (
      <>
        <p>
          Open Settings with <K>Ctrl+,</K> or the gear icon. Changes apply immediately and are saved
          to <code>%APPDATA%\CodeForge\settings.json</code>. Use the search box to find a setting,
          or <strong>Reset all</strong> to go back to the defaults.
        </p>
        <table>
          <thead>
            <tr>
              <th>Setting</th>
              <th>Default</th>
              <th>What it does</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>workbench.colorTheme</code>
              </td>
              <td>CodeForge Dark</td>
              <td>Dark or light theme</td>
            </tr>
            <tr>
              <td>
                <code>workbench.restoreWorkspace</code>
              </td>
              <td>on</td>
              <td>Reopen the last folder at startup</td>
            </tr>
            <tr>
              <td>
                <code>window.zoomLevel</code>
              </td>
              <td>0</td>
              <td>Zoom of the whole window (each step is 20%)</td>
            </tr>
            <tr>
              <td>
                <code>editor.fontSize</code>
              </td>
              <td>14</td>
              <td>Editor font size</td>
            </tr>
            <tr>
              <td>
                <code>editor.fontFamily</code>
              </td>
              <td>Cascadia Code, …</td>
              <td>Editor font</td>
            </tr>
            <tr>
              <td>
                <code>editor.tabSize</code> / <code>editor.insertSpaces</code>
              </td>
              <td>2 / on</td>
              <td>Indentation for new files (existing files are detected)</td>
            </tr>
            <tr>
              <td>
                <code>editor.wordWrap</code>
              </td>
              <td>off</td>
              <td>Wrap long lines</td>
            </tr>
            <tr>
              <td>
                <code>editor.minimap</code>
              </td>
              <td>on</td>
              <td>Code overview on the right</td>
            </tr>
            <tr>
              <td>
                <code>editor.formatOnSave</code>
              </td>
              <td>off</td>
              <td>Format supported files when saving</td>
            </tr>
            <tr>
              <td>
                <code>files.autoSave</code>
              </td>
              <td>afterDelay</td>
              <td>Save automatically shortly after you stop typing (off / afterDelay)</td>
            </tr>
            <tr>
              <td>
                <code>files.autoSaveDelay</code>
              </td>
              <td>1000</td>
              <td>Milliseconds to wait after the last change before auto saving</td>
            </tr>
            <tr>
              <td>
                <code>files.exclude</code>
              </td>
              <td>.git, …</td>
              <td>Names hidden from the Explorer</td>
            </tr>
            <tr>
              <td>
                <code>search.exclude</code>
              </td>
              <td>node_modules, dist, …</td>
              <td>Names skipped by search and Go to File</td>
            </tr>
            <tr>
              <td>
                <code>terminal.defaultProfile</code>
              </td>
              <td>(Automatic: PowerShell)</td>
              <td>Shell for new terminals: PowerShell, Command Prompt, PowerShell 7, Git Bash…</td>
            </tr>
            <tr>
              <td>
                <code>terminal.shell</code>
              </td>
              <td>(empty)</td>
              <td>Full path of another shell program, used instead of the default terminal</td>
            </tr>
            <tr>
              <td>
                <code>terminal.fontSize</code>
              </td>
              <td>13</td>
              <td>Terminal font size</td>
            </tr>
            <tr>
              <td>
                <code>python.languageServer</code>
              </td>
              <td>on</td>
              <td>Python IntelliSense (Pyright)</td>
            </tr>
            <tr>
              <td>
                <code>update.checkOnStartup</code>
              </td>
              <td>on</td>
              <td>Check for and download updates automatically</td>
            </tr>
          </tbody>
        </table>
        <p>
          If <code>settings.json</code> contains an invalid value, CodeForge uses the default for
          that setting and keeps the rest.
        </p>
      </>
    ),
  },
  {
    slug: "keyboard-shortcuts",
    title: "Keyboard shortcuts",
    description: "Every default keyboard shortcut in one place.",
    section: "Reference",
    body: (
      <>
        <p>
          The Command Palette (<K>Ctrl+Shift+P</K>) and <em>Help → Keyboard Shortcuts</em> list
          every command with its shortcut. These are the defaults on Windows:
        </p>
        <h2>General</h2>
        <table>
          <tbody>
            <tr>
              <td>Command Palette</td>
              <td>
                <K>Ctrl+Shift+P</K> or <K>F1</K>
              </td>
            </tr>
            <tr>
              <td>Go to File</td>
              <td>
                <K>Ctrl+P</K>
              </td>
            </tr>
            <tr>
              <td>Settings</td>
              <td>
                <K>Ctrl+,</K>
              </td>
            </tr>
            <tr>
              <td>Toggle side bar / panel</td>
              <td>
                <K>Ctrl+B</K> / <K>Ctrl+J</K>
              </td>
            </tr>
            <tr>
              <td>Explorer / Search / Source Control / Run</td>
              <td>
                <K>Ctrl+Shift+E</K> / <K>Ctrl+Shift+F</K> / <K>Ctrl+Shift+G</K> /{" "}
                <K>Ctrl+Shift+D</K>
              </td>
            </tr>
            <tr>
              <td>Problems / Output</td>
              <td>
                <K>Ctrl+Shift+M</K> / <K>Ctrl+Shift+U</K>
              </td>
            </tr>
            <tr>
              <td>Zoom in / out / reset</td>
              <td>
                <K>Ctrl+=</K> / <K>Ctrl+-</K> / <K>Ctrl+0</K>
              </td>
            </tr>
            <tr>
              <td>Open a menu (File, Edit, Selection, View, Go, Run, Terminal, Help)</td>
              <td>
                <K>Alt+F</K>, <K>Alt+E</K>, <K>Alt+S</K>, <K>Alt+V</K>, <K>Alt+G</K>, <K>Alt+R</K>,{" "}
                <K>Alt+T</K>, <K>Alt+H</K>
              </td>
            </tr>
          </tbody>
        </table>
        <h2>Files and tabs</h2>
        <table>
          <tbody>
            <tr>
              <td>New file / Open file</td>
              <td>
                <K>Ctrl+N</K> / <K>Ctrl+O</K>
              </td>
            </tr>
            <tr>
              <td>Save / Save As / Save All</td>
              <td>
                <K>Ctrl+S</K> / <K>Ctrl+Shift+S</K> / <K>Ctrl+Alt+S</K>
              </td>
            </tr>
            <tr>
              <td>New file in the open folder</td>
              <td>
                <K>Ctrl+Alt+N</K>
              </td>
            </tr>
            <tr>
              <td>Close tab / exit CodeForge</td>
              <td>
                <K>Ctrl+W</K> / <K>Alt+F4</K>
              </td>
            </tr>
            <tr>
              <td>Next / previous tab</td>
              <td>
                <K>Ctrl+Tab</K> / <K>Ctrl+Shift+Tab</K>
              </td>
            </tr>
          </tbody>
        </table>
        <h2>Editing and navigation</h2>
        <table>
          <tbody>
            <tr>
              <td>Find / Replace</td>
              <td>
                <K>Ctrl+F</K> / <K>Ctrl+H</K>
              </td>
            </tr>
            <tr>
              <td>Go to line / symbol</td>
              <td>
                <K>Ctrl+G</K> / <K>Ctrl+Shift+O</K>
              </td>
            </tr>
            <tr>
              <td>Go to definition / references</td>
              <td>
                <K>F12</K> / <K>Shift+F12</K>
              </td>
            </tr>
            <tr>
              <td>Rename symbol</td>
              <td>
                <K>F2</K>
              </td>
            </tr>
            <tr>
              <td>Next problem</td>
              <td>
                <K>F8</K>
              </td>
            </tr>
            <tr>
              <td>Toggle comment</td>
              <td>
                <K>Ctrl+/</K>
              </td>
            </tr>
            <tr>
              <td>Format document</td>
              <td>
                <K>Shift+Alt+F</K>
              </td>
            </tr>
            <tr>
              <td>Word wrap</td>
              <td>
                <K>Alt+Z</K>
              </td>
            </tr>
            <tr>
              <td>Select line / expand / shrink selection</td>
              <td>
                <K>Ctrl+L</K> / <K>Shift+Alt+Right</K> / <K>Shift+Alt+Left</K>
              </td>
            </tr>
            <tr>
              <td>Add cursor above / below</td>
              <td>
                <K>Ctrl+Alt+Up</K> / <K>Ctrl+Alt+Down</K>
              </td>
            </tr>
            <tr>
              <td>Show suggestions</td>
              <td>
                <K>Ctrl+Space</K>
              </td>
            </tr>
          </tbody>
        </table>
        <h2>Terminal and run</h2>
        <table>
          <tbody>
            <tr>
              <td>Toggle terminal / new terminal</td>
              <td>
                <K>Ctrl+`</K> / <K>Ctrl+Shift+`</K>
              </td>
            </tr>
            <tr>
              <td>Split terminal</td>
              <td>
                <K>Ctrl+Shift+5</K>
              </td>
            </tr>
            <tr>
              <td>Run current file / start debugging / stop</td>
              <td>
                <K>Ctrl+F5</K> / <K>F5</K> / <K>Shift+F5</K>
              </td>
            </tr>
            <tr>
              <td>Commit (in the message box)</td>
              <td>
                <K>Ctrl+Enter</K>
              </td>
            </tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    slug: "security",
    title: "Security & privacy",
    description: "How CodeForge protects your computer and your code.",
    section: "Reference",
    body: (
      <>
        <p>
          A code editor opens files from anywhere and runs commands, so CodeForge is built on the
          principle that the user interface should not be able to do anything you didn&apos;t ask
          for.
        </p>
        <h2>How the app is isolated</h2>
        <ul>
          <li>
            The interface runs in a <strong>sandboxed renderer</strong> with{" "}
            <strong>context isolation</strong> and <strong>no Node.js access</strong>.
          </li>
          <li>
            It talks to the system only through a small bridge with an{" "}
            <strong>allow-list of operations</strong>. Every request is validated in the main
            process, and requests from any other page are rejected.
          </li>
          <li>
            File operations are limited to <strong>the folder you opened</strong> (plus files you
            explicitly pick in an Open or Save dialog). Paths that escape it — including through
            symbolic links or junctions — are refused.
          </li>
          <li>
            The UI is loaded from a private <code>app://</code> origin with a strict{" "}
            <strong>Content Security Policy</strong>: no remote scripts, no inline scripts, no
            plugins, no frames. Navigation away from the app and new windows are blocked.
          </li>
          <li>
            Previews of HTML files and local servers open in a{" "}
            <strong>separate sandboxed window</strong> with its own temporary session, no bridge,
            and every permission (camera, microphone, location…) denied.
          </li>
          <li>
            Deleting files moves them to the Recycle Bin, and destructive Git actions ask for
            confirmation.
          </li>
        </ul>
        <h2>Updates</h2>
        <p>
          Automatic updates (from 0.2.0) are downloaded over HTTPS from this project&apos;s GitHub
          Releases. Each download is checked against the SHA-512 recorded with the release before it
          is installed, and CodeForge asks before restarting. You can turn automatic checks off in
          Settings.
        </p>
        <h2>Running code</h2>
        <p>
          CodeForge never runs code on its own. Commands run only when you type them in the terminal
          or click Run, and the exact command is shown in the terminal.
        </p>
        <h2>Your data</h2>
        <p>
          There is no telemetry, no account and no cloud sync. See the{" "}
          <Link href="/privacy">privacy policy</Link>.
        </p>
        <h2>Reporting a vulnerability</h2>
        <p>
          Please report security issues privately through the contact options on the{" "}
          <Link href="/support">support page</Link> rather than in a public issue.
        </p>
      </>
    ),
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    description: "Fixes for common problems.",
    section: "Help",
    body: (
      <>
        <h2>Windows says “Windows protected your PC”</h2>
        <p>
          Early releases are not code-signed. Click <strong>More info → Run anyway</strong>. To make
          sure the file is genuine, compare its SHA-256 (<code>Get-FileHash</code> in PowerShell)
          with the one on the <Link href="/download">download page</Link>.
        </p>
        <h2>The terminal doesn&apos;t start</h2>
        <ul>
          <li>
            Check <code>terminal.shell</code> in Settings. Clear it to go back to PowerShell, or
            enter the full path to your shell.
          </li>
          <li>CodeForge needs Windows 10 version 1809 or later for its terminal (ConPTY).</li>
          <li>
            If you installed CodeForge into a very deeply nested folder (a path longer than about
            140 characters), Windows may skip some of the terminal&apos;s files. Reinstall into the
            default location or a shorter folder such as <code>C:\Apps\CodeForge</code>.
          </li>
        </ul>
        <h2>Source Control says Git was not found</h2>
        <p>
          Install Git from <a href="https://git-scm.com/downloads">git-scm.com</a>, make sure{" "}
          <code>git --version</code> works in a new terminal, then restart CodeForge.
        </p>
        <h2>A commit fails with “Please tell me who you are”</h2>
        <p>
          Set your identity once in the terminal:{" "}
          <code>git config --global user.name &quot;Your Name&quot;</code> and{" "}
          <code>git config --global user.email you@example.com</code>.
        </p>
        <h2>Run Active File says a command is not recognized</h2>
        <p>
          The language runtime (for example Node.js or Python) isn&apos;t installed or isn&apos;t on
          your PATH. Install it, then open a new terminal.
        </p>
        <h2>“Access denied: that path is outside the open folder”</h2>
        <p>
          CodeForge only reads and writes inside the folder you opened. Open the parent folder, or
          use <em>File → Open File…</em> to open a single file elsewhere.
        </p>
        <h2>Reset everything</h2>
        <p>
          Close CodeForge and delete <code>%APPDATA%\CodeForge\settings.json</code> (settings) or{" "}
          <code>state.json</code> (recent folders and window position).
        </p>
        <h2>Logs</h2>
        <p>
          CodeForge writes a diagnostic log to <code>%APPDATA%\CodeForge\logs\codeforge.log</code>.
          It contains file paths and errors, never file contents. Attach it when{" "}
          <Link href="/support">reporting a problem</Link>.
        </p>
      </>
    ),
  },
  {
    slug: "building-from-source",
    title: "Building from source",
    description: "Set up a development environment and build installers.",
    section: "Help",
    body: (
      <>
        <h2>Prerequisites</h2>
        <ul>
          <li>Node.js 22 or newer (with npm)</li>
          <li>Git</li>
          <li>No C++ compiler is needed: the terminal&apos;s native module ships prebuilt.</li>
        </ul>
        <h2>Set up and run</h2>
        <pre>
          <code>{`npm run setup          # installs dependencies, downloads Electron, syncs brand files
npm run dev:desktop    # CodeForge with hot reload
npm run dev:web        # this website at http://localhost:3000`}</code>
        </pre>
        <h2>Test</h2>
        <pre>
          <code>{`npm test               # unit and integration tests (desktop + website)
npm run test:e2e       # launches the real app and website and drives them
npm run verify         # typecheck, lint, tests and production builds`}</code>
        </pre>
        <h2>Build installers</h2>
        <pre>
          <code>{`npm run package:win                         # Windows NSIS installer
cd desktop && npx electron-builder --mac    # on a Mac
cd desktop && npx electron-builder --linux  # on Linux`}</code>
        </pre>
        <p>
          Installers are written to <code>desktop/release/</code>. The Windows step also records the
          installer&apos;s size and SHA-256 in <code>brand/release-manifest.json</code>, which the
          website uses for its download page.
        </p>
        <h2>Project layout</h2>
        <table>
          <tbody>
            <tr>
              <td>
                <code>desktop/</code>
              </td>
              <td>
                The Electron app: <code>src/main</code> (system access), <code>src/preload</code>{" "}
                (bridge), <code>src/renderer</code> (UI), <code>src/shared</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>website/</code>
              </td>
              <td>This Next.js website, deployed to Vercel</td>
            </tr>
            <tr>
              <td>
                <code>brand/</code>
              </td>
              <td>Logo, colors and product info shared by both</td>
            </tr>
            <tr>
              <td>
                <code>docs/</code>
              </td>
              <td>Architecture, deployment and release documentation</td>
            </tr>
          </tbody>
        </table>
      </>
    ),
  },
];

export const DOC_SECTIONS: DocPage["section"][] = ["Start", "Using CodeForge", "Reference", "Help"];

export function getDoc(slug: string): DocPage | undefined {
  return DOCS.find((doc) => doc.slug === slug);
}
