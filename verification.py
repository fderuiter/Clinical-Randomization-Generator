from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:4200")
    page.wait_for_timeout(2000)

    # Click the "Generator" link in the header
    page.get_by_role("link", name="Generator").first.click()
    page.wait_for_timeout(2000)

    # We should be on step 1 of the wizard. Let's fill out basic metadata
    page.get_by_label("Protocol ID").fill("TEST-123")
    page.wait_for_timeout(500)
    page.get_by_role("button", name="Next").click()
    page.wait_for_timeout(1000)

    # Step 2: Arms
    page.get_by_role("button", name="Next").click()
    page.wait_for_timeout(1000)

    # Step 3: Strata - Check drag handle visual affordance
    # Hover over the drag handle to trigger its styles
    page.get_by_role("button", name="Drag to reorder factor").first.hover()
    page.wait_for_timeout(500)

    # Take screenshot of the hover state of the drag handle
    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(1000)

    # Focus the drag handle to show focus rings
    page.get_by_role("button", name="Drag to reorder factor").first.focus()
    page.wait_for_timeout(500)
    page.screenshot(path="/home/jules/verification/screenshots/verification_focus.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
