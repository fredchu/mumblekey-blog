#!/usr/bin/env python3
import argparse
import datetime as dt
import json
import re
import subprocess
import sys
import textwrap
from pathlib import Path


REPO_OWNER = "fredchu"
REPO_NAME = "mumblekey-blog"
SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n?", re.S)

DISCUSSIONS_QUERY = """
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    discussions(first: 100, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes {
        id
        title
        createdAt
        comments(first: 50) {
          totalCount
          nodes {
            id
            bodyText
            createdAt
            author { login }
          }
        }
      }
    }
  }
}
"""

ADD_COMMENT_MUTATION = """
mutation($discussionId: ID!, $body: String!) {
  addDiscussionComment(input: {discussionId: $discussionId, body: $body}) {
    comment { id url }
  }
}
"""

MINIMIZE_COMMENT_MUTATION = """
mutation($subjectId: ID!, $classifier: ReportedContentClassifiers!) {
  minimizeComment(input: {subjectId: $subjectId, classifier: $classifier}) {
    minimizedComment { isMinimized }
  }
}
"""

DELETE_COMMENT_MUTATION = """
mutation($id: ID!) {
  deleteDiscussionComment(input: {id: $id}) {
    clientMutationId
  }
}
"""


def today() -> str:
    return dt.date.today().isoformat()


def rel(root: Path, path: Path) -> str:
    return str(path.relative_to(root))


def err(message: str) -> None:
    print(message, file=sys.stderr)


def valid_slug(slug: str) -> bool:
    return bool(SLUG_RE.fullmatch(slug))


def parse_value(value: str):
    value = value.strip()
    if value in {"true", "false"}:
        return value == "true"
    if value.startswith("[") and value.endswith("]"):
        inner = value[1:-1].strip()
        return [] if not inner else [item.strip() for item in inner.split(",")]
    return value.strip("\"'")


def format_value(value) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, list):
        return "[" + ", ".join(str(item) for item in value) + "]"
    return str(value)


def parse_frontmatter(text: str) -> dict:
    match = FRONTMATTER_RE.match(text)
    if not match:
        return {}
    data = {}
    for line in match.group(1).splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key_match = re.match(r"^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$", line)
        if key_match:
            data[key_match.group(1)] = parse_value(key_match.group(2))
    return data


def write_frontmatter(text: str, updates: dict) -> str:
    match = FRONTMATTER_RE.match(text)
    if not match:
        raise ValueError("missing frontmatter")
    seen = set()
    lines = []
    for line in match.group(1).splitlines():
        key_match = re.match(r"^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$", line)
        if key_match and key_match.group(1) in updates:
            key = key_match.group(1)
            lines.append(f"{key}: {format_value(updates[key])}")
            seen.add(key)
        else:
            lines.append(line)
    for key, value in updates.items():
        if key not in seen:
            lines.append(f"{key}: {format_value(value)}")
    return "---\n" + "\n".join(lines) + "\n---\n" + text[match.end():]


def content_dir(root: Path) -> Path:
    return root / "src" / "content"


def post_path(root: Path, collection: str, lang: str, slug: str, suffix: str) -> Path:
    return content_dir(root) / collection / lang / f"{slug}{suffix}"


def find_post_path(root: Path, collection: str, lang: str, slug: str) -> Path | None:
    for suffix in (".md", ".mdx"):
        path = post_path(root, collection, lang, slug, suffix)
        if path.exists():
            return path
    return None


def post_template(title: str, term: str, body: str) -> str:
    return textwrap.dedent(f"""\
---
title: {title}
description: TODO
pubDate: {today()}
tags: []
draft: true
discussionTerm: {term}
---

{body}
""")


def cmd_new(args) -> int:
    if not valid_slug(args.slug):
        err(f"invalid slug: {args.slug}")
        return 1
    collection = "demos" if args.demo else "blog"
    suffix = ".mdx" if args.demo else ".md"
    term = f"demo-{args.slug}" if args.demo else args.slug
    targets = [
        post_path(args.root, collection, "zh", args.slug, suffix),
        post_path(args.root, collection, "en", args.slug, suffix),
    ]
    existing_suffixes = (".mdx",) if args.demo else (".md", ".mdx")
    if any(post_path(args.root, collection, lang, args.slug, suffix).exists() for lang in ("zh", "en") for suffix in existing_suffixes):
        err(f"slug already exists: {args.slug}")
        return 1

    bodies = {
        "zh": "<!-- TODO: 撰寫文章內容。 -->\n<!-- TODO: 加入段落、程式碼或圖片。 -->\n<!-- TODO: MDX 可 import demo 元件。 -->\n",
        "en": "<!-- TODO: Write the post body. -->\n<!-- TODO: Add sections, code, or images. -->\n<!-- TODO: MDX can import demo components. -->\n",
    }
    titles = {"zh": args.title_zh or args.slug, "en": args.title_en or args.slug}
    for lang, path in zip(("zh", "en"), targets):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(post_template(titles[lang], term, bodies[lang]), encoding="utf-8")
        print(rel(args.root, path))
    return 0


def read_post(path: Path) -> dict:
    if not path.exists():
        return {}
    data = parse_frontmatter(path.read_text(encoding="utf-8"))
    data["_path"] = path
    return data


def row_status(zh: dict, en: dict) -> str:
    if not zh or not en:
        return "partial"
    drafts = [bool(zh.get("draft", False)), bool(en.get("draft", False))]
    if all(drafts):
        return "draft"
    if not any(drafts):
        return "published"
    return "partial"


def cmd_list(args) -> int:
    roots = {lang: content_dir(args.root) / "blog" / lang for lang in ("zh", "en")}
    slugs = set()
    for root in roots.values():
        for suffix in ("*.md", "*.mdx"):
            slugs.update(path.stem for path in root.glob(suffix))

    print("slug\tzh\ten\tpubDate\tstatus")
    for slug in sorted(slugs):
        zh = read_post(find_post_path(args.root, "blog", "zh", slug) or roots["zh"] / f"{slug}.md")
        en = read_post(find_post_path(args.root, "blog", "en", slug) or roots["en"] / f"{slug}.md")
        status = row_status(zh, en)
        has_draft = bool(zh.get("draft", False)) or bool(en.get("draft", False))
        if args.drafts and not has_draft:
            continue
        print(
            "\t".join(
                [
                    slug,
                    str(zh.get("title", "")),
                    str(en.get("title", "")),
                    str(zh.get("pubDate") or en.get("pubDate") or ""),
                    status,
                ]
            )
        )
    return 0


def cmd_search(args) -> int:
    needle = args.keyword.lower()
    for path in sorted(content_dir(args.root).rglob("*")):
        if path.suffix not in {".md", ".mdx"}:
            continue
        for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if needle in line.lower():
                shown = line[:117] + "..." if len(line) > 120 else line
                print(f"{rel(args.root, path)}:{line_no}: {shown}")
    return 0


def cmd_publish(args) -> int:
    if not valid_slug(args.slug):
        err(f"invalid slug: {args.slug}")
        return 1
    paths = [find_post_path(args.root, "blog", lang, args.slug) for lang in ("zh", "en")]
    existing = [path for path in paths if path]
    for lang, path in zip(("zh", "en"), paths):
        if not path:
            err(f"warning: missing {rel(args.root, post_path(args.root, 'blog', lang, args.slug, '.md'))}")
    if not existing:
        err(f"no files found for slug: {args.slug}")
        return 1

    for path in existing:
        text = path.read_text(encoding="utf-8")
        data = parse_frontmatter(text)
        if not data.get("draft", False):
            print(f"already published: {rel(args.root, path)}")
            continue
        path.write_text(write_frontmatter(text, {"draft": False, "pubDate": today()}), encoding="utf-8")
        print(f"published: {rel(args.root, path)}")
    return 0


def cmd_unpublish(args) -> int:
    if not valid_slug(args.slug):
        err(f"invalid slug: {args.slug}")
        return 1
    collection = "demos" if args.demo else "blog"
    paths = [find_post_path(args.root, collection, lang, args.slug) for lang in ("zh", "en")]
    existing = [path for path in paths if path]
    if not existing:
        err(f"no files found for slug: {args.slug}")
        return 1
    for path in existing:
        text = path.read_text(encoding="utf-8")
        data = parse_frontmatter(text)
        if data.get("draft", False):
            print(f"already draft: {rel(args.root, path)}")
            continue
        path.write_text(write_frontmatter(text, {"draft": True}), encoding="utf-8")
        print(f"unpublished: {rel(args.root, path)}")
    print("reminder: rebuild + deploy to remove from the live site (git push or `blog deploy`)")
    return 0


def cmd_delete(args) -> int:
    if not valid_slug(args.slug):
        err(f"invalid slug: {args.slug}")
        return 1
    collection = "demos" if args.demo else "blog"
    paths = [(lang, find_post_path(args.root, collection, lang, args.slug)) for lang in ("zh", "en")]
    existing = [(lang, path) for lang, path in paths if path]
    if not existing:
        err(f"no files found for slug: {args.slug}")
        return 1
    drafts_dir = args.root / "drafts"
    moves = [(path, drafts_dir / f"{args.slug}.{lang}{path.suffix}") for lang, path in existing]
    if not args.yes:
        for src, dest in moves:
            print(f"would move: {rel(args.root, src)} -> {rel(args.root, dest)}")
        print("soft delete only (moves to gitignored drafts/); re-run with --yes to execute")
        return 0
    drafts_dir.mkdir(exist_ok=True)
    for src, dest in moves:
        src.rename(dest)
        print(f"moved: {rel(args.root, src)} -> {rel(args.root, dest)}")
    print("reminder: rebuild + deploy to remove from the live site;")
    print("if this was ever pushed, the content still exists in the public repo's git history")
    return 0


def run_process(command: list[str]) -> int:
    return subprocess.run(command).returncode


def cmd_preview(args) -> int:
    return run_process(["npx", "astro", "dev"])


def cmd_deploy(args) -> int:
    for command in (["npm", "run", "build"], ["npx", "wrangler", "deploy"]):
        rc = run_process(command)
        if rc:
            return rc
    return 0


def run_gh(args: list[str]) -> tuple[int, str]:
    try:
        proc = subprocess.run(["gh", *args], capture_output=True, text=True)
    except FileNotFoundError:
        return 127, ""
    return proc.returncode, proc.stdout


def gh_graphql(query: str, fields: dict[str, str]) -> tuple[int, str]:
    args = ["api", "graphql", "-f", f"query={query}"]
    for key, value in fields.items():
        args.extend(["-F", f"{key}={value}"])
    return run_gh(args)


def load_discussions() -> tuple[int, list[dict]]:
    # ponytail: ceiling is 100 recent discussions; add cursor pagination if the blog outgrows that.
    rc, stdout = gh_graphql(DISCUSSIONS_QUERY, {"owner": REPO_OWNER, "name": REPO_NAME})
    if rc:
        return rc, []
    data = json.loads(stdout)
    nodes = data["data"]["repository"]["discussions"]["nodes"]
    return 0, nodes


def discussion_by_slug(slug: str) -> tuple[int, dict | None]:
    rc, discussions = load_discussions()
    if rc:
        return rc, None
    for discussion in discussions:
        if discussion.get("title") == slug:
            return 0, discussion
    return 0, None


def print_comment(comment: dict) -> None:
    author = (comment.get("author") or {}).get("login", "")
    body = (comment.get("bodyText") or "").replace("\n", " ")
    print(f"{comment.get('id', '')}\t{author}\t{comment.get('createdAt', '')}\t{body[:100]}")


def cmd_comments_list(args) -> int:
    rc, discussions = load_discussions()
    if rc:
        err("gh api graphql failed")
        return rc
    if args.slug:
        discussion = next((item for item in discussions if item.get("title") == args.slug), None)
        if not discussion:
            err(f"discussion not found: {args.slug}")
            return 1
        for comment in discussion["comments"]["nodes"]:
            print_comment(comment)
        return 0
    for discussion in discussions[:20]:
        print(f"{discussion['title']}\t{discussion['comments']['totalCount']}")
    return 0


def cmd_comments_reply(args) -> int:
    rc, discussion = discussion_by_slug(args.discussion_slug)
    if rc:
        err("gh api graphql failed")
        return rc
    if not discussion:
        err(f"discussion not found: {args.discussion_slug}")
        return 1
    rc, stdout = gh_graphql(ADD_COMMENT_MUTATION, {"discussionId": discussion["id"], "body": args.body})
    if stdout:
        print(stdout, end="")
    return rc


def cmd_comments_hide(args) -> int:
    rc, stdout = gh_graphql(MINIMIZE_COMMENT_MUTATION, {"subjectId": args.comment_node_id, "classifier": args.reason})
    if stdout:
        print(stdout, end="")
    return rc


def cmd_comments_delete(args) -> int:
    print(f"warning: delete discussion comment {args.comment_node_id}", file=sys.stderr)
    if not args.yes:
        print(DELETE_COMMENT_MUTATION.strip())
        return 0
    rc, stdout = gh_graphql(DELETE_COMMENT_MUTATION, {"id": args.comment_node_id})
    if stdout:
        print(stdout, end="")
    return rc


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="blog")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    sub = parser.add_subparsers(dest="command", required=True)

    new = sub.add_parser("new")
    new.add_argument("slug")
    new.add_argument("--title-zh")
    new.add_argument("--title-en")
    new.add_argument("--demo", action="store_true")
    new.set_defaults(func=cmd_new)

    list_cmd = sub.add_parser("list")
    list_cmd.add_argument("--drafts", action="store_true")
    list_cmd.set_defaults(func=cmd_list)

    search = sub.add_parser("search")
    search.add_argument("keyword")
    search.set_defaults(func=cmd_search)

    publish = sub.add_parser("publish")
    publish.add_argument("slug")
    publish.set_defaults(func=cmd_publish)

    unpublish = sub.add_parser("unpublish")
    unpublish.add_argument("slug")
    unpublish.add_argument("--demo", action="store_true")
    unpublish.set_defaults(func=cmd_unpublish)

    delete = sub.add_parser("delete")
    delete.add_argument("slug")
    delete.add_argument("--demo", action="store_true")
    delete.add_argument("--yes", action="store_true")
    delete.set_defaults(func=cmd_delete)

    preview = sub.add_parser("preview")
    preview.set_defaults(func=cmd_preview)

    deploy = sub.add_parser("deploy")
    deploy.set_defaults(func=cmd_deploy)

    comments = sub.add_parser("comments")
    comments_sub = comments.add_subparsers(dest="comments_command", required=True)

    comments_list = comments_sub.add_parser("list")
    comments_list.add_argument("slug", nargs="?")
    comments_list.set_defaults(func=cmd_comments_list)

    reply = comments_sub.add_parser("reply")
    reply.add_argument("discussion_slug")
    reply.add_argument("--body", required=True)
    reply.set_defaults(func=cmd_comments_reply)

    hide = comments_sub.add_parser("hide")
    hide.add_argument("comment_node_id")
    hide.add_argument("--reason", choices=["SPAM", "ABUSE", "OUTDATED", "OFF_TOPIC"], default="SPAM")
    hide.set_defaults(func=cmd_comments_hide)

    delete = comments_sub.add_parser("delete")
    delete.add_argument("comment_node_id")
    delete.add_argument("--yes", action="store_true")
    delete.set_defaults(func=cmd_comments_delete)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    args.root = args.root.resolve()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
