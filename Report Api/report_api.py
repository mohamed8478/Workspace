from pathlib import Path
from datetime import datetime, timezone

from flask import Flask, abort, jsonify, send_file


BASE_DIR = Path(__file__).resolve().parent

REPORTS = {
    "client": {
        "label": "Sortie Platre par Client",
        "file": BASE_DIR / "Sortie Plâtre par Client.xlsx",
    },
    "camion": {
        "label": "Sortie Platre par Camion",
        "file": BASE_DIR / "Sortie Plâtre par Camion.xlsx",
    },
}


app = Flask(__name__)


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


@app.get("/api/reports")
def list_reports():
    reports = []

    for report_id, report in REPORTS.items():
        report_file = report["file"]
        exists = report_file.exists()

        reports.append(
            {
                "id": report_id,
                "label": report["label"],
                "filename": report_file.name,
                "available": exists,
                "sizeBytes": report_file.stat().st_size if exists else None,
                "lastModified": (
                    datetime.fromtimestamp(report_file.stat().st_mtime, tz=timezone.utc).isoformat()
                    if exists
                    else None
                ),
                "downloadUrl": f"/api/reports/{report_id}/download",
            }
        )

    return jsonify(reports)


@app.get("/api/reports/<report_id>/download")
def download_report(report_id):
    report = REPORTS.get(report_id)

    if report is None:
        abort(404, description="Unknown report")

    report_file = report["file"]

    if not report_file.exists():
        abort(404, description="Report file not found")

    return send_file(
        report_file,
        as_attachment=True,
        download_name=report_file.name,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
