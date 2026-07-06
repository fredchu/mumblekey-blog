import importlib.util
import sys
from pathlib import Path

import pytest


SPEC = importlib.util.spec_from_file_location("blog", Path(__file__).with_name("blog.py"))
blog = importlib.util.module_from_spec(SPEC)
sys.modules["blog"] = blog
SPEC.loader.exec_module(blog)


def write_post(root, lang, slug, title, draft, pub_date="2020-01-01", body="Body"):
    path = root / "src" / "content" / "blog" / lang / f"{slug}.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        f"""---
title: {title}
description: Desc
pubDate: {pub_date}
tags: [test]
draft: {"true" if draft else "false"}
---

{body}
""",
        encoding="utf-8",
    )
    return path


@pytest.mark.parametrize("slug", ["abc", "a1-b2", "post-123"])
def test_valid_slug(slug):
    assert blog.valid_slug(slug)


@pytest.mark.parametrize("slug", ["", "A", "-a", "a-", "a--b", "a_b"])
def test_invalid_slug(slug):
    assert not blog.valid_slug(slug)


def test_new_creates_pair_frontmatter_and_rejects_duplicate(tmp_path, capsys):
    rc = blog.main(["--root", str(tmp_path), "new", "my-post", "--title-zh", "中文", "--title-en", "English"])
    assert rc == 0
    out = capsys.readouterr().out
    assert "src/content/blog/zh/my-post.md" in out
    assert "src/content/blog/en/my-post.md" in out

    zh = tmp_path / "src" / "content" / "blog" / "zh" / "my-post.md"
    en = tmp_path / "src" / "content" / "blog" / "en" / "my-post.md"
    assert zh.exists()
    assert en.exists()
    zh_data = blog.parse_frontmatter(zh.read_text(encoding="utf-8"))
    en_data = blog.parse_frontmatter(en.read_text(encoding="utf-8"))
    assert zh_data["title"] == "中文"
    assert en_data["title"] == "English"
    assert zh_data["description"] == "TODO"
    assert zh_data["pubDate"] == blog.today()
    assert zh_data["tags"] == []
    assert zh_data["draft"] is True
    assert zh_data["discussionTerm"] == "my-post"

    assert blog.main(["--root", str(tmp_path), "new", "my-post"]) == 1


def test_list_classifies_draft_published_and_partial(tmp_path, capsys):
    write_post(tmp_path, "zh", "draft-post", "草稿", True)
    write_post(tmp_path, "en", "draft-post", "Draft", True)
    write_post(tmp_path, "zh", "published-post", "已發", False)
    write_post(tmp_path, "en", "published-post", "Published", False)
    write_post(tmp_path, "zh", "partial-post", "半成品", True)
    write_post(tmp_path, "en", "mismatch-post", "Mismatch", False)
    write_post(tmp_path, "zh", "mismatch-post", "不一致", True)

    assert blog.main(["--root", str(tmp_path), "list"]) == 0
    out = capsys.readouterr().out
    assert "draft-post\t草稿\tDraft\t2020-01-01\tdraft" in out
    assert "published-post\t已發\tPublished\t2020-01-01\tpublished" in out
    assert "partial-post\t半成品\t\t2020-01-01\tpartial" in out
    assert "mismatch-post\t不一致\tMismatch\t2020-01-01\tpartial" in out

    assert blog.main(["--root", str(tmp_path), "list", "--drafts"]) == 0
    drafts = capsys.readouterr().out
    assert "draft-post" in drafts
    assert "published-post" not in drafts
    assert "partial-post" in drafts


def test_publish_flips_draft_updates_pubdate_and_skips_published(tmp_path, capsys):
    zh = write_post(tmp_path, "zh", "ship-it", "發佈", True)
    en = write_post(tmp_path, "en", "ship-it", "Ship", True)

    assert blog.main(["--root", str(tmp_path), "publish", "ship-it"]) == 0
    out = capsys.readouterr().out
    assert "published: src/content/blog/zh/ship-it.md" in out
    assert blog.parse_frontmatter(zh.read_text(encoding="utf-8"))["draft"] is False
    assert blog.parse_frontmatter(en.read_text(encoding="utf-8"))["pubDate"] == blog.today()

    assert blog.main(["--root", str(tmp_path), "publish", "ship-it"]) == 0
    assert "already published: src/content/blog/zh/ship-it.md" in capsys.readouterr().out


def test_search_matches_case_insensitive_content(tmp_path, capsys):
    write_post(tmp_path, "zh", "find-me", "找", False, body="Alpha KEYword omega")
    demo = tmp_path / "src" / "content" / "demos" / "en" / "demo.mdx"
    demo.parent.mkdir(parents=True, exist_ok=True)
    demo.write_text("---\ntitle: Demo\n---\nno match\n", encoding="utf-8")

    assert blog.main(["--root", str(tmp_path), "search", "keyword"]) == 0
    out = capsys.readouterr().out
    assert "src/content/blog/zh/find-me.md:9: Alpha KEYword omega" in out


def test_frontmatter_roundtrip_changes_only_requested_field():
    text = """---
title: Demo
description: Desc
pubDate: 2020-01-01
tags: [a, b]
draft: true
sourceUrl: https://example.com
---

Body
"""
    data = blog.parse_frontmatter(text)
    assert data["tags"] == ["a", "b"]
    updated = blog.write_frontmatter(text, {"draft": False})
    assert "draft: false" in updated
    assert "sourceUrl: https://example.com" in updated
    assert updated.endswith("\nBody\n")
    assert "title: Demo\ndescription: Desc\npubDate: 2020-01-01\ntags: [a, b]" in updated
