from jinja2 import Environment, FileSystemLoader
from pathlib import Path
import shutil, json
from config import CONFIG

# Set up Jinja2
template_root = Path("templates")
env = Environment(loader=FileSystemLoader(template_root))

output_root = Path("docs")

# All .j2
template_root = Path("templates")
output_root = Path("docs")
env = Environment(loader=FileSystemLoader(template_root))

# Alle .j2-Dateien durchgehen
for path in template_root.rglob("*.j2"):
    relative_path = path.relative_to(template_root)
    key = relative_path.parts[0]
    output_path = output_root / relative_path.with_suffix("").with_suffix(".html")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    section_dir = template_root / key
    nav_path = section_dir / "nav.json"
    config_path = section_dir / "config.json"

    try:
        xCONFIG = {
            "nav": json.load(open(nav_path)) if nav_path.exists() else {},
            "config": json.load(open(config_path)) if config_path.exists() else {}
        }
    except Exception as e:
        print(f"[WARN] Couldn't load {key}: {e}")
        xCONFIG = {"nav": {}, "config": {}}

    template_name = relative_path.as_posix()
    template = env.get_template(template_name)
    rendered = template.render(
        config=xCONFIG["config"],
        nav=xCONFIG["nav"],
        meta=CONFIG["meta"]
    )

    output_path.write_text(rendered, encoding="utf-8")

print("Render completed!")

# static_src = Path("static")
# static_dst = output_root / "static"
# if static_src.exists():
#     if static_dst.exists():
#         shutil.rmtree(static_dst)
#     shutil.copytree(static_src, static_dst)