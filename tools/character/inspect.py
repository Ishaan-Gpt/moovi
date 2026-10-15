"""Inspect a character mesh before rigging: topology, scale, symmetry, materials, plus turnaround renders.

Run headless:
  blender --background --factory-startup --python tools/character/inspect.py -- <model.glb|fbx|obj> <out_dir>
Writes <out_dir>/report.json and <out_dir>/view_{front,right,back,left,three_quarter}.png
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector
from mathutils.kdtree import KDTree

argv = sys.argv[sys.argv.index("--") + 1:]
src, out = os.path.abspath(argv[0]), os.path.abspath(argv[1])
os.makedirs(out, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
ext = os.path.splitext(src)[1].lower()
if ext in (".glb", ".gltf"):
    bpy.ops.import_scene.gltf(filepath=src)
elif ext == ".fbx":
    bpy.ops.import_scene.fbx(filepath=src)
elif ext == ".obj":
    bpy.ops.wm.obj_import(filepath=src)
else:
    sys.exit(f"unsupported file type: {ext}")

scene = bpy.context.scene
meshes = [o for o in scene.objects if o.type == "MESH"]
if not meshes:
    sys.exit("no mesh objects found")

def mesh_stats(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.transform(obj.matrix_world)
    # glTF splits vertices at UV/normal seams; weld a copy so topology numbers describe the real surface
    raw_verts = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.verts.index_update()
    faces = bm.faces
    tris = sum(1 for f in faces if len(f.verts) == 3)
    quads = sum(1 for f in faces if len(f.verts) == 4)
    non_manifold = sum(1 for e in bm.edges if not e.is_manifold)
    boundary = sum(1 for e in bm.edges if e.is_boundary)
    loose_verts = sum(1 for v in bm.verts if not v.link_edges)
    # connected parts
    seen, islands = set(), 0
    for v in bm.verts:
        if v.index in seen:
            continue
        islands += 1
        stack = [v]
        while stack:
            cur = stack.pop()
            if cur.index in seen:
                continue
            seen.add(cur.index)
            stack.extend(e.other_vert(cur) for e in cur.link_edges)
    tri_equiv = sum(len(f.verts) - 2 for f in faces)
    coords = [v.co.copy() for v in bm.verts]
    bm.free()
    mats = []
    for slot in obj.material_slots:
        m = slot.material
        if not m:
            continue
        imgs = []
        if m.use_nodes:
            for n in m.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image:
                    imgs.append({"name": n.image.name, "size": list(n.image.size)})
        mats.append({"name": m.name, "images": imgs})
    return {
        "object": obj.name,
        "verts": len(coords), "verts_before_weld": raw_verts, "faces": len(faces), "tris_equivalent": tri_equiv,
        "tris": tris, "quads": quads, "ngons": len(faces) - tris - quads,
        "non_manifold_edges": non_manifold, "boundary_edges": boundary,
        "loose_verts": loose_verts, "connected_parts": islands,
        "uv_layers": [uv.name for uv in obj.data.uv_layers],
        "materials": mats,
        "has_armature_modifier": any(m.type == "ARMATURE" for m in obj.modifiers),
        "vertex_groups": len(obj.vertex_groups),
    }, coords

report = {"source": src, "objects": [], "armatures": [], "actions": [a.name for a in bpy.data.actions]}
all_coords = []
for o in meshes:
    s, c = mesh_stats(o)
    report["objects"].append(s)
    all_coords += c
for a in (o for o in scene.objects if o.type == "ARMATURE"):
    report["armatures"].append({"name": a.name, "bones": [b.name for b in a.data.bones]})

lo = Vector((min(v.x for v in all_coords), min(v.y for v in all_coords), min(v.z for v in all_coords)))
hi = Vector((max(v.x for v in all_coords), max(v.y for v in all_coords), max(v.z for v in all_coords)))
size = hi - lo
center = (hi + lo) / 2
report["bounds"] = {"min": list(lo), "max": list(hi), "size_xyz": list(size), "height": size.z}

# Left/right symmetry about the bbox centre on X: distance from each mirrored vertex to its nearest real vertex
kd = KDTree(len(all_coords))
for i, v in enumerate(all_coords):
    kd.insert(v, i)
kd.balance()
step = max(1, len(all_coords) // 4000)
dists = []
for v in all_coords[::step]:
    m = Vector((2 * center.x - v.x, v.y, v.z))
    dists.append(kd.find(m)[2])
dists.sort()
h = size.z or 1.0
report["symmetry_x"] = {
    "mean_pct_of_height": round(100 * sum(dists) / len(dists) / h, 3),
    "p95_pct_of_height": round(100 * dists[int(0.95 * (len(dists) - 1))] / h, 3),
    "max_pct_of_height": round(100 * dists[-1] / h, 3),
}
report["totals"] = {
    "verts": sum(o["verts"] for o in report["objects"]),
    "tris_equivalent": sum(o["tris_equivalent"] for o in report["objects"]),
    "non_manifold_edges": sum(o["non_manifold_edges"] for o in report["objects"]),
    "connected_parts": sum(o["connected_parts"] for o in report["objects"]),
}

# Turnaround renders: orthographic, workbench, texture colour + cavity so form reads clearly
scene.render.engine = "BLENDER_WORKBENCH"
shading = scene.display.shading
shading.light = "STUDIO"
shading.color_type = "TEXTURE"
shading.show_cavity = True
shading.show_object_outline = True
scene.render.film_transparent = False
scene.world = scene.world or bpy.data.worlds.new("World")
scene.render.resolution_x, scene.render.resolution_y = 768, 1024
cam_data = bpy.data.cameras.new("InspectCam")
cam_data.type = "ORTHO"
# ortho_scale spans the longer (vertical) side of the 3:4 frame, so widen it for wide models
aspect = scene.render.resolution_x / scene.render.resolution_y
cam_data.ortho_scale = max(size.z, max(size.x, size.y) / aspect) * 1.12
cam = bpy.data.objects.new("InspectCam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
dist = max(size) * 4 + 1
# glTF front (+Z) imports as Blender -Y, so "front" looks from -Y toward +Y
views = {"front": -90, "right": 0, "back": 90, "left": 180, "three_quarter": -45}
for name, deg in views.items():
    a = math.radians(deg)
    cam.location = center + Vector((math.cos(a) * dist, math.sin(a) * dist, 0))
    direction = center - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(out, f"view_{name}.png")
    bpy.ops.render.render(write_still=True)

with open(os.path.join(out, "report.json"), "w") as f:
    json.dump(report, f, indent=2)
t = report["totals"]
print(f"[inspect] {len(meshes)} mesh(es) · {t['verts']} verts · {t['tris_equivalent']} tris · "
      f"{t['connected_parts']} parts · {t['non_manifold_edges']} non-manifold edges · "
      f"height {size.z:.3f} · symmetry p95 {report['symmetry_x']['p95_pct_of_height']}% of height")
