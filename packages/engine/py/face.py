"""How much of a clip shows a face: sample N frames, run OpenCV's frontal-face Haar cascade on each.
Usage: python face.py <video> [--samples 12]  ->  prints {"samples": n, "faces": k, "ratio": k/n, "largest": frac}
Used by intake to tell a talking head (footage to edit) from an edited reference. Local, no network."""
import argparse, json, cv2

ap = argparse.ArgumentParser(); ap.add_argument("video"); ap.add_argument("--samples", type=int, default=12)
a = ap.parse_args()
cap = cv2.VideoCapture(a.video)
n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
faces, seen, largest = 0, 0, 0.0
for i in range(a.samples):
    if n: cap.set(cv2.CAP_PROP_POS_FRAMES, int((i + 0.5) * n / a.samples))
    ok, frame = cap.read()
    if not ok: continue
    seen += 1
    h, w = frame.shape[:2]
    small = cv2.resize(frame, (max(1, w * 480 // max(w, h)), max(1, h * 480 // max(w, h))))
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    found = cascade.detectMultiScale(gray, scaleFactor=1.15, minNeighbors=5, minSize=(30, 30))
    if len(found):
        faces += 1
        largest = max(largest, max(fw * fh for (_, _, fw, fh) in found) / float(gray.shape[0] * gray.shape[1]))
print(json.dumps({"samples": seen, "faces": faces, "ratio": round(faces / seen, 3) if seen else 0, "largest": round(largest, 3)}))
