from pathlib import Path
import json
import time

import requests
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError


BASE = "http://localhost:5173"
API = "http://localhost:8080/api"
OUT = Path("test_screenshots")
OUT.mkdir(exist_ok=True)


USERS = {
    "thukho": "thukho@gmail.com",
    "bgh": "hieutruong@gmail.com",
    "lanhdao": "lanhdao@gmail.com",
    "canbo": "canbo.hoasinh@gmail.com",
    "admin": "admin@gmail.com",
}


def login_user(email):
    res = requests.post(f"{API}/auth/login", json={"email": email, "password": "12345"}, timeout=10)
    res.raise_for_status()
    data = res.json()
    if not data.get("success"):
        raise RuntimeError(f"Login failed for {email}: {data}")
    return data["user"]


def open_dashboard(page, user):
    page.goto(BASE, wait_until="networkidle")
    page.evaluate("user => localStorage.setItem('currentUser', JSON.stringify(user))", user)
    page.goto(f"{BASE}/dashboard", wait_until="networkidle")
    page.wait_for_timeout(900)
    try:
        page.get_by_text("Đang kiểm tra quyền", exact=False).wait_for(state="hidden", timeout=8000)
    except PlaywrightTimeoutError:
        pass
    try:
        page.get_by_text("Đang đồng bộ quyền", exact=False).wait_for(state="hidden", timeout=8000)
    except PlaywrightTimeoutError:
        pass
    page.wait_for_timeout(700)


def click_text(page, text, exact=False, timeout=5000):
    target = page.get_by_text(text, exact=exact).first
    target.click(timeout=timeout)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(700)


def try_click_text(page, text, exact=False, timeout=2500):
    try:
        click_text(page, text, exact=exact, timeout=timeout)
        return True
    except PlaywrightTimeoutError:
        return False


def shot(page, name):
    page.screenshot(path=str(OUT / name), full_page=True)


def close_overlay(page):
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    page.mouse.click(24, 24)
    page.wait_for_timeout(500)


def capture_thukho(page, users):
    open_dashboard(page, users["thukho"])
    shot(page, "equipment_list.png")
    try:
        page.get_by_placeholder("Tìm theo mã hoặc tên vật tư...").fill("NaCl")
        page.wait_for_timeout(700)
    except PlaywrightTimeoutError:
        pass
    shot(page, "equipment_search.png")
    try:
        page.locator(".dh-noti-btn").click(timeout=2500)
        page.wait_for_timeout(700)
        shot(page, "notifications_dropdown.png")
    except PlaywrightTimeoutError:
        pass
    open_dashboard(page, users["thukho"])
    click_text(page, "Tạo phiếu dự trù", exact=True)
    shot(page, "supp_forecast_form.png")
    click_text(page, "Lịch sử phiếu dự trù", exact=True)
    shot(page, "supp_forecast_sent.png")

    click_text(page, "Nhập kho", exact=True)
    shot(page, "receipt_form.png")
    click_text(page, "Lịch sử phiếu nhập", exact=True)
    shot(page, "receipt_history.png")
    try_click_text(page, "Xem", exact=True)
    shot(page, "receipt_saved.png")

    open_dashboard(page, users["thukho"])
    click_text(page, "Xuất kho", exact=True)
    shot(page, "issue_preview.png")
    if try_click_text(page, "Xem phiếu không đủ điều kiện", exact=True):
        shot(page, "issue_ineligible_reasons.png")
    click_text(page, "Lịch sử phiếu xuất", exact=True)
    shot(page, "issue_done.png")
    try_click_text(page, "Xem", exact=True)
    shot(page, "issue_history_detail.png")


def capture_bgh(page, users):
    open_dashboard(page, users["bgh"])
    click_text(page, "Phê duyệt dự trù", exact=True)
    shot(page, "forecast_pending_list.png")
    try_click_text(page, "Xem", exact=True)
    shot(page, "forecast_pending_detail.png")
    close_overlay(page)
    try_click_text(page, "Đã xử lý", exact=True)
    shot(page, "forecast_approved.png")


def capture_canbo(page, users):
    open_dashboard(page, users["canbo"])
    click_text(page, "Tạo phiếu xin lĩnh", exact=True)
    shot(page, "create_issue_req.png")


def capture_lanhdao(page, users):
    open_dashboard(page, users["lanhdao"])
    click_text(page, "Phê duyệt phiếu xin lĩnh", exact=True)
    shot(page, "ira_preview.png")
    try_click_text(page, "Lịch sử", exact=False)
    shot(page, "ira_approved.png")


def capture_admin(page, users):
    open_dashboard(page, users["admin"])
    click_text(page, "Quản lý người dùng", exact=True)
    shot(page, "admin_users.png")
    click_text(page, "Phân quyền vai trò", exact=True)
    shot(page, "rbac_permissions.png")


def capture_public(page):
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(600)
    shot(page, "auth_login.png")
    try_click_text(page, "Quên mật khẩu", exact=False)
    shot(page, "auth_reset_password.png")


def main():
    users = {key: login_user(email) for key, email in USERS.items()}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        capture_public(page)
        capture_thukho(page, users)
        capture_bgh(page, users)
        capture_canbo(page, users)
        capture_lanhdao(page, users)
        capture_admin(page, users)
        browser.close()


if __name__ == "__main__":
    main()
