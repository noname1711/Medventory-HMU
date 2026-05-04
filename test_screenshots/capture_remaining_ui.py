from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import expect, sync_playwright


BASE_URL = "http://localhost:5173"
OUT_DIR = Path(__file__).resolve().parent


USERS = {
    "bgh": ("hieutruong@gmail.com", "12345"),
    "thukho": ("thukho@gmail.com", "12345"),
}


def save(page, filename, full_page=True):
    path = OUT_DIR / filename
    page.screenshot(path=str(path), full_page=full_page)
    print(path)


def login(page, role):
    email, password = USERS[role]
    page.goto(BASE_URL, wait_until="domcontentloaded")
    page.get_by_placeholder("Email").fill(email)
    page.get_by_placeholder("Mật khẩu").fill(password)
    page.locator("form").get_by_role("button", name="Đăng nhập").click()
    page.wait_for_url("**/dashboard", timeout=10000)
    page.wait_for_timeout(1200)


def click_tab(page, name):
    page.get_by_role("button", name=name).click()
    page.wait_for_timeout(700)


def capture_auth(page):
    page.goto(BASE_URL, wait_until="domcontentloaded")
    expect(page.locator("form").get_by_role("button", name="Đăng nhập")).to_be_visible()
    save(page, "auth_login.png")

    page.goto(f"{BASE_URL}/reset-password?token=DEMO-RESET-2026", wait_until="domcontentloaded")
    expect(page.get_by_role("button", name="Đặt lại mật khẩu")).to_be_visible()
    page.get_by_placeholder("Nhập mật khẩu mới...").fill("12345")
    page.get_by_placeholder("Xác nhận lại mật khẩu mới...").fill("12345")
    save(page, "auth_reset_password.png")


def capture_bgh_pages(page):
    login(page, "bgh")

    click_tab(page, "Danh sách vật tư")
    page.get_by_placeholder("Tìm theo mã hoặc tên vật tư...").fill("Gạc")
    page.wait_for_timeout(500)
    save(page, "equipment_search.png")

    page.get_by_placeholder("VD: VT001").fill("VT-DEMO")
    page.get_by_placeholder("Nhập tên vật tư").fill("Bộ dây truyền dịch demo")
    page.get_by_placeholder("VD: Hộp 50 chiếc").fill("Hộp 20 bộ")
    page.get_by_placeholder("Nhập hãng sản xuất").fill("HMU Supply")
    try:
        page.locator("select.ui-select").first.select_option(index=1)
    except PlaywrightTimeoutError:
        pass
    save(page, "add_equipment_form.png")

    click_tab(page, "Quản lý người dùng")
    expect(page.get_by_text("Danh sách tài khoản")).to_be_visible(timeout=10000)
    save(page, "admin_users_refreshed.png")

    click_tab(page, "Phân quyền vai trò")
    expect(page.get_by_role("heading", name="Phân quyền theo role")).to_be_visible(timeout=10000)
    save(page, "rbac_permissions.png")

    page.locator(".dh-noti-btn").click()
    page.wait_for_timeout(900)
    save(page, "notifications_dropdown.png")


def capture_thukho_pages(page):
    login(page, "thukho")
    click_tab(page, "Xuất kho")
    expect(page.get_by_text("Phiếu xin lĩnh đủ điều kiện xuất")).to_be_visible(timeout=10000)

    page.get_by_role("button", name="Xem phiếu không đủ điều kiện").click()
    page.wait_for_timeout(700)
    page.mouse.wheel(0, 520)
    page.wait_for_timeout(300)
    save(page, "issue_ineligible_reasons.png")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        page = context.new_page()
        page.set_default_timeout(10000)

        capture_auth(page)

        context.clear_cookies()
        page.evaluate("localStorage.clear(); sessionStorage.clear();")
        capture_bgh_pages(page)

        context.clear_cookies()
        page.evaluate("localStorage.clear(); sessionStorage.clear();")
        capture_thukho_pages(page)

        browser.close()


if __name__ == "__main__":
    main()
