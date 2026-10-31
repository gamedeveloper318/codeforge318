import { monaco } from "./setup";

/**
 * Completion for languages that have no language service bundled with
 * CodeForge: each language's keywords and common built-ins, plus snippets for
 * the usual structures (if, for, while, function, class, main, ...). Together
 * with word-based suggestions (names used in open files) this gives useful
 * suggestions in Java, C, C++, C#, Go, Rust, PHP, Ruby, SQL and more.
 * TypeScript/JavaScript, HTML, CSS, JSON and Python (Pyright) have full
 * language services instead and are not handled here.
 */
interface LanguageCompletions {
  keywords: string[];
  builtins?: string[];
  snippets: Record<string, { body: string; description: string }>;
}

const words = (text: string) => text.split(/\s+/).filter(Boolean);

const C_LIKE_SNIPPETS = {
  if: { body: "if (${1:condition}) {\n\t$0\n}", description: "if statement" },
  ifelse: {
    body: "if (${1:condition}) {\n\t$2\n} else {\n\t$0\n}",
    description: "if / else statement",
  },
  for: {
    body: "for (int ${1:i} = 0; ${1:i} < ${2:count}; ${1:i}++) {\n\t$0\n}",
    description: "for loop",
  },
  while: { body: "while (${1:condition}) {\n\t$0\n}", description: "while loop" },
  switch: {
    body: "switch (${1:value}) {\n\tcase ${2:value}:\n\t\t$0\n\t\tbreak;\n\tdefault:\n\t\tbreak;\n}",
    description: "switch statement",
  },
};

const LANGUAGES: Record<string, LanguageCompletions> = {
  java: {
    keywords: words(
      "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while var record true false null",
    ),
    builtins: words(
      "String System Integer Double Boolean Character Math List ArrayList Map HashMap Set HashSet Scanner Object Exception RuntimeException Arrays Collections Optional StringBuilder",
    ),
    snippets: {
      ...C_LIKE_SNIPPETS,
      main: {
        body: "public static void main(String[] args) {\n\t$0\n}",
        description: "main method",
      },
      sout: { body: "System.out.println($0);", description: "print a line (System.out.println)" },
      class: { body: "public class ${1:Name} {\n\t$0\n}", description: "class" },
      foreach: {
        body: "for (${1:String} ${2:item} : ${3:items}) {\n\t$0\n}",
        description: "for-each loop",
      },
      try: {
        body: "try {\n\t$1\n} catch (${2:Exception} e) {\n\t$0\n}",
        description: "try / catch",
      },
    },
  },
  c: {
    keywords: words(
      "auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while NULL true false bool",
    ),
    builtins: words(
      "printf scanf puts gets fgets fopen fclose fprintf malloc calloc realloc free strlen strcpy strcmp strcat memcpy memset exit abs rand srand time",
    ),
    snippets: {
      ...C_LIKE_SNIPPETS,
      main: {
        body: "#include <stdio.h>\n\nint main(void) {\n\t$0\n\treturn 0;\n}",
        description: "main function",
      },
      printf: { body: 'printf("${1:%d}\\n", ${2:value});', description: "printf" },
      include: { body: "#include <${1:stdio.h}>", description: "#include" },
      struct: { body: "struct ${1:Name} {\n\t$0\n};", description: "struct" },
    },
  },
  cpp: {
    keywords: words(
      "alignas alignof and asm auto bool break case catch char class const constexpr const_cast continue decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept nullptr operator private protected public register reinterpret_cast return short signed sizeof static static_assert static_cast struct switch template this throw true try typedef typeid typename union unsigned using virtual void volatile while override final",
    ),
    builtins: words(
      "std cout cin cerr endl string vector map unordered_map set pair make_pair sort find size push_back emplace_back begin end unique_ptr shared_ptr make_unique make_shared printf",
    ),
    snippets: {
      ...C_LIKE_SNIPPETS,
      main: {
        body: "#include <iostream>\n\nint main() {\n\t$0\n\treturn 0;\n}",
        description: "main function",
      },
      cout: { body: "std::cout << ${1:value} << std::endl;", description: "print with std::cout" },
      class: {
        body: "class ${1:Name} {\npublic:\n\t${1:Name}();\n\t$0\n};",
        description: "class",
      },
      foreach: { body: "for (auto& ${1:item} : ${2:items}) {\n\t$0\n}", description: "range for" },
    },
  },
  csharp: {
    keywords: words(
      "abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using var virtual void volatile while async await record",
    ),
    builtins: words("Console WriteLine ReadLine List Dictionary String Math Task Exception"),
    snippets: {
      ...C_LIKE_SNIPPETS,
      cw: { body: "Console.WriteLine($0);", description: "Console.WriteLine" },
      foreach: {
        body: "foreach (var ${1:item} in ${2:items})\n{\n\t$0\n}",
        description: "foreach loop",
      },
      class: { body: "public class ${1:Name}\n{\n\t$0\n}", description: "class" },
      main: {
        body: "static void Main(string[] args)\n{\n\t$0\n}",
        description: "Main method",
      },
    },
  },
  go: {
    keywords: words(
      "break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var true false nil iota",
    ),
    builtins: words(
      "append cap close complex copy delete imag len make new panic print println real recover string int int64 float64 bool byte rune error fmt Println Printf Sprintf Errorf",
    ),
    snippets: {
      main: {
        body: 'package main\n\nimport "fmt"\n\nfunc main() {\n\t$0\n}',
        description: "main package",
      },
      func: { body: "func ${1:name}(${2}) ${3:error} {\n\t$0\n}", description: "function" },
      if: { body: "if ${1:condition} {\n\t$0\n}", description: "if statement" },
      iferr: { body: "if err != nil {\n\treturn ${1:err}\n}", description: "if err != nil" },
      for: {
        body: "for ${1:i} := 0; ${1:i} < ${2:n}; ${1:i}++ {\n\t$0\n}",
        description: "for loop",
      },
      forr: {
        body: "for ${1:_}, ${2:v} := range ${3:items} {\n\t$0\n}",
        description: "for range",
      },
      struct: { body: "type ${1:Name} struct {\n\t$0\n}", description: "struct type" },
      pl: { body: "fmt.Println($0)", description: "fmt.Println" },
    },
  },
  rust: {
    keywords: words(
      "as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while",
    ),
    builtins: words(
      "println print format vec String Vec Option Some None Result Ok Err Box HashMap Rc Arc clone unwrap expect iter map collect len push",
    ),
    snippets: {
      main: { body: "fn main() {\n\t$0\n}", description: "main function" },
      fn: {
        body: "fn ${1:name}(${2}) -> ${3:()} {\n\t$0\n}",
        description: "function",
      },
      println: { body: 'println!("${1:{}}", ${2:value});', description: "println!" },
      if: { body: "if ${1:condition} {\n\t$0\n}", description: "if expression" },
      for: { body: "for ${1:item} in ${2:items} {\n\t$0\n}", description: "for loop" },
      match: {
        body: "match ${1:value} {\n\t${2:pattern} => $0,\n\t_ => {}\n}",
        description: "match",
      },
      struct: { body: "struct ${1:Name} {\n\t$0\n}", description: "struct" },
      impl: { body: "impl ${1:Name} {\n\t$0\n}", description: "impl block" },
    },
  },
  php: {
    keywords: words(
      "abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile extends final finally fn for foreach function global goto if implements include include_once instanceof insteadof interface isset list match namespace new or print private protected public require require_once return static switch throw trait try unset use var while yield true false null",
    ),
    builtins: words(
      "strlen str_replace explode implode count array_push array_map array_filter in_array json_encode json_decode var_dump print_r isset empty htmlspecialchars date time",
    ),
    snippets: {
      ...C_LIKE_SNIPPETS,
      php: { body: "<?php\n\n$0", description: "PHP open tag" },
      function: { body: "function ${1:name}(${2}) {\n\t$0\n}", description: "function" },
      foreach: {
        body: "foreach (\\$${1:items} as \\$${2:item}) {\n\t$0\n}",
        description: "foreach loop",
      },
      echo: { body: 'echo "${1:text}";', description: "echo" },
      class: { body: "class ${1:Name}\n{\n\t$0\n}", description: "class" },
    },
  },
  ruby: {
    keywords: words(
      "BEGIN END alias and begin break case class def defined do else elsif end ensure false for if in module next nil not or redo rescue retry return self super then true undef unless until when while yield",
    ),
    builtins: words(
      "puts print p require require_relative attr_accessor attr_reader each map select times length gets chomp to_s to_i",
    ),
    snippets: {
      def: { body: "def ${1:name}(${2})\n\t$0\nend", description: "method" },
      class: { body: "class ${1:Name}\n\t$0\nend", description: "class" },
      if: { body: "if ${1:condition}\n\t$0\nend", description: "if" },
      each: { body: "${1:items}.each do |${2:item}|\n\t$0\nend", description: "each loop" },
    },
  },
  sql: {
    keywords: words(
      "SELECT FROM WHERE INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE ALTER DROP INDEX VIEW JOIN INNER LEFT RIGHT FULL OUTER ON GROUP BY ORDER ASC DESC HAVING LIMIT OFFSET DISTINCT AS AND OR NOT NULL IS IN BETWEEN LIKE EXISTS UNION ALL PRIMARY KEY FOREIGN REFERENCES DEFAULT UNIQUE CHECK CONSTRAINT INTEGER INT TEXT VARCHAR BOOLEAN DATE TIMESTAMP CASE WHEN THEN ELSE END",
    ),
    builtins: words("COUNT SUM AVG MIN MAX COALESCE NOW LOWER UPPER LENGTH ROUND CAST"),
    snippets: {
      select: {
        body: "SELECT ${1:*}\nFROM ${2:table}\nWHERE ${3:condition};",
        description: "SELECT",
      },
      insert: {
        body: "INSERT INTO ${1:table} (${2:columns})\nVALUES (${3:values});",
        description: "INSERT",
      },
      create: {
        body: "CREATE TABLE ${1:name} (\n\tid INTEGER PRIMARY KEY,\n\t$0\n);",
        description: "CREATE TABLE",
      },
    },
  },
  kotlin: {
    keywords: words(
      "as break class continue do else false for fun if in interface is null object package return super this throw true try typealias val var when while by catch constructor data enum finally import init lateinit override private protected public sealed suspend",
    ),
    builtins: words("println print listOf mutableListOf mapOf setOf String Int Double Boolean"),
    snippets: {
      main: { body: "fun main() {\n\t$0\n}", description: "main function" },
      fun: { body: "fun ${1:name}(${2}): ${3:Unit} {\n\t$0\n}", description: "function" },
    },
  },
  swift: {
    keywords: words(
      "class deinit enum extension func import init let protocol struct subscript typealias var break case continue default defer do else fallthrough for guard if in repeat return switch where while as catch false is nil self super throw throws true try",
    ),
    builtins: words("print String Int Double Bool Array Dictionary Set"),
    snippets: { func: { body: "func ${1:name}(${2}) {\n\t$0\n}", description: "function" } },
  },
  dart: {
    keywords: words(
      "abstract as assert async await break case catch class const continue default do dynamic else enum extends false final finally for if import in is late new null required return static super switch this throw true try var void while with",
    ),
    builtins: words("print String int double bool List Map Set Future"),
    snippets: { main: { body: "void main() {\n\t$0\n}", description: "main function" } },
  },
  lua: {
    keywords: words(
      "and break do else elseif end false for function goto if in local nil not or repeat return then true until while",
    ),
    builtins: words("print pairs ipairs tostring tonumber type table string math require"),
    snippets: {
      function: { body: "function ${1:name}(${2})\n\t$0\nend", description: "function" },
      for: { body: "for ${1:i} = 1, ${2:n} do\n\t$0\nend", description: "numeric for" },
    },
  },
  shell: {
    keywords: words(
      "if then else elif fi case esac for select while until do done in function time return exit export local readonly",
    ),
    builtins: words("echo printf read cd ls pwd mkdir rm cp mv cat grep sed awk test source"),
    snippets: {
      if: { body: "if [ ${1:condition} ]; then\n\t$0\nfi", description: "if" },
      for: { body: "for ${1:item} in ${2:items}; do\n\t$0\ndone", description: "for loop" },
    },
  },
  powershell: {
    keywords: words(
      "begin break catch class continue data do dynamicparam else elseif end exit filter finally for foreach from function if in param process return switch throw trap try until using var while",
    ),
    builtins: words(
      "Write-Host Write-Output Get-ChildItem Get-Content Set-Content Get-Item Remove-Item Copy-Item Move-Item New-Item Test-Path Get-Process Start-Process Select-Object Where-Object ForEach-Object",
    ),
    snippets: {
      function: { body: "function ${1:Name} {\n\tparam(${2})\n\t$0\n}", description: "function" },
      foreach: {
        body: "foreach (\\$${1:item} in \\$${2:items}) {\n\t$0\n}",
        description: "foreach loop",
      },
    },
  },
  r: {
    keywords: words(
      "if else repeat while function for next break TRUE FALSE NULL Inf NaN NA in library",
    ),
    builtins: words("print paste cat c list data.frame length sum mean nrow ncol head tail"),
    snippets: {
      function: { body: "${1:name} <- function(${2}) {\n\t$0\n}", description: "function" },
    },
  },
};

export function registerLanguageCompletions(): void {
  for (const [language, data] of Object.entries(LANGUAGES)) {
    monaco.languages.registerCompletionItemProvider(language, {
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        const kinds = monaco.languages.CompletionItemKind;
        const suggestions: monaco.languages.CompletionItem[] = [
          ...data.keywords.map((keyword) => ({
            label: keyword,
            kind: kinds.Keyword,
            insertText: keyword,
            detail: "keyword",
            range,
          })),
          ...(data.builtins ?? []).map((name) => ({
            label: name,
            kind: kinds.Function,
            insertText: name,
            detail: "built-in",
            range,
          })),
          ...Object.entries(data.snippets).map(([prefix, snippet]) => ({
            label: prefix,
            kind: kinds.Snippet,
            insertText: snippet.body,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: snippet.description,
            documentation: {
              value: "```\n" + snippet.body.replace(/\$\{\d+:?([^}]*)\}|\$\d/g, "$1") + "\n```",
            },
            range,
          })),
        ];
        return { suggestions };
      },
    });
  }
}
