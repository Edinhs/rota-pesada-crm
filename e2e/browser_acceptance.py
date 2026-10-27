"""Acceptance in a disposable database. Requires Python Playwright and Chromium.

Run after npm run build: python e2e/browser_acceptance.py
No operational database or externally running server is used.
"""
from pathlib import Path
import json
import os
import re
import socket
import subprocess
import tempfile
import time
import urllib.request

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts" / "browser"
with socket.socket() as port_probe:
    port_probe.bind(("127.0.0.1", 0))
    PORT = port_probe.getsockname()[1]
URL = f"http://127.0.0.1:{PORT}"


def read_state():
    with urllib.request.urlopen(URL + "/api/state", timeout=5) as response:
        return json.load(response)


def start_server(data_dir, log):
    env = {**os.environ, "CRM_DATA_DIR": str(data_dir), "PORT": str(PORT)}
    process = subprocess.Popen(
        ["node", "--import", "tsx", "server/index.ts"],
        cwd=ROOT, env=env, stdout=log, stderr=log,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    for _ in range(100):
        if process.poll() is not None:
            raise RuntimeError("Acceptance server exited. Inspect artifacts/browser/server.log")
        try:
            with urllib.request.urlopen(URL + "/api/health", timeout=1) as response:
                if response.status == 200:
                    return process
        except OSError:
            time.sleep(0.1)
    process.terminate()
    raise RuntimeError("Acceptance server did not become healthy")


def stop_server(process):
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


def run():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="crm-browser-") as directory:
        with (OUTPUT / "server.log").open("w", encoding="utf8") as log:
            server = start_server(Path(directory) / "data", log)
            try:
                assert not read_state()["clients"], "Disposable database must start empty"
                with sync_playwright() as p:
                    browser = p.chromium.launch(headless=True)
                    page = browser.new_page(viewport={"width": 1440, "height": 1000}, locale="pt-BR", timezone_id="America/Sao_Paulo")
                    page.set_default_timeout(10000)
                    errors = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.goto(URL, wait_until="networkidle")
                    expect(page.get_by_role("heading", name="Peças certas.", exact=False)).to_be_visible()
                    page.screenshot(path=str(OUTPUT / "01-empty.png"), full_page=True)
                    (OUTPUT / "initial-dom.txt").write_text(page.locator("body").inner_text(), encoding="utf8")
                    def nav(name):
                        if name == "Configurações":
                            page.locator(".sidebar-bottom").get_by_role("button", name=name, exact=True).click()
                        else:
                            page.get_by_role("navigation").get_by_role("button", name=name, exact=True).click()

                    def dialog():
                        return page.get_by_role("dialog")

                    def save(label="Salvar"):
                        dialog().get_by_role("button", name=label, exact=True).click()
                        expect(page.get_by_role("dialog")).to_have_count(0)

                    def save_settings():
                        button = page.get_by_role("button", name="Salvar alterações", exact=True)
                        with page.expect_response(lambda response: response.url.endswith("/api/settings") and response.request.method == "PUT" and response.status == 200):
                            button.click()
                        expect(button).to_be_enabled()
                        expect(page.get_by_role("status")).to_contain_text("Dados da empresa salvos")

                    # Customer: Escape restores focus; failed save preserves entered data.
                    nav("Clientes")
                    new_client = page.get_by_role("button", name="Novo cliente", exact=True)
                    new_client.click()
                    page.keyboard.press("Escape")
                    expect(new_client).to_be_focused()
                    new_client.click()
                    page.keyboard.press("Shift+Tab")
                    expect(dialog().get_by_role("button", name="Salvar", exact=True)).to_be_focused()
                    page.keyboard.press("Tab")
                    expect(dialog().get_by_role("button", name="Fechar janela")).to_be_focused()
                    dialog().get_by_label("Nome / razão social", exact=False).fill("Transportadora QA")
                    dialog().get_by_label("Telefone / WhatsApp").fill("31999999999")
                    dialog().get_by_label("Cidade", exact=True).fill("Contagem")
                    dialog().get_by_label("UF", exact=True).fill("MG")
                    page.route("**/api/clients", lambda route: route.fulfill(status=503, content_type="application/json", body='{"message":"Falha simulada: tente novamente."}'))
                    dialog().get_by_role("button", name="Salvar", exact=True).click()
                    expect(dialog().get_by_role("alert")).to_contain_text("Falha simulada")
                    expect(dialog().get_by_label("Nome / razão social", exact=False)).to_have_value("Transportadora QA")
                    page.unroute("**/api/clients")
                    save()

                    nav("Catálogo de peças")
                    for sku, description, price in [("QA-FILTRO", "Filtro de óleo QA", "125,00"), ("QA-CORREIA", "Correia QA", "49,90")]:
                        page.get_by_role("button", name="Nova peça", exact=True).click()
                        dialog().get_by_label("Código interno / SKU", exact=False).fill(sku)
                        dialog().get_by_label("Descrição", exact=False).fill(description)
                        dialog().get_by_label("Fabricante", exact=True).fill("Fabricante QA")
                        dialog().get_by_label("Preço de referência", exact=False).fill(price)
                        dialog().get_by_label("Referências / códigos OEM", exact=False).fill("OEM-QA-001")
                        dialog().get_by_label("Aplicação declarada", exact=True).fill("Aplicação fictícia para teste")
                        save()
                    page.get_by_role("textbox", name="Buscar código, referência, marca ou aplicação").fill("OEM-QA-001")
                    expect(page.get_by_role("row")).to_have_count(3)
                    page.screenshot(path=str(OUTPUT / "02-catalog.png"), full_page=True)

                    nav("Negociações")
                    page.get_by_role("button", name="Novo atendimento", exact=True).first.click()
                    (OUTPUT / "deal-dialog.txt").write_text(page.locator("body").inner_text(), encoding="utf8")
                    page.screenshot(path=str(OUTPUT / "deal-dialog.png"), full_page=True)
                    dialog().get_by_label("Cliente *", exact=True).select_option(index=1)
                    dialog().get_by_label("Título do atendimento", exact=False).fill("Reposição QA")
                    dialog().get_by_label("Veículo / aplicação solicitada").fill("Caminhão de teste")
                    save()
                    page.get_by_label("Mover Reposição QA").select_option("qualification")
                    expect(page.locator(".column-qualification")).to_contain_text("Reposição QA")

                    nav("Agenda")
                    page.get_by_role("button", name="Agendar atividade", exact=True).first.click()
                    dialog().get_by_label("Cliente *", exact=True).select_option(index=1)
                    dialog().get_by_label("Negociação relacionada").select_option(index=1)
                    dialog().get_by_label("Tipo", exact=True).select_option("task")
                    dialog().get_by_label("Atividade *", exact=True).fill("Retornar orçamento QA")
                    dialog().get_by_label("Data e horário").fill("2000-01-01T12:00")
                    save()
                    expect(page.get_by_role("button", name="Concluir Retornar orçamento QA")).to_be_visible()

                    nav("Orçamentos")
                    page.get_by_role("button", name="Criar orçamento", exact=True).first.click()
                    dialog().get_by_label("Negociação *", exact=True).select_option(index=1)
                    dialog().get_by_label("Peça 1 *", exact=True).select_option(label="QA-FILTRO — Filtro de óleo QA")
                    dialog().get_by_label("Qtde. *", exact=True).fill("2")
                    dialog().get_by_role("button", name="Adicionar item").click()
                    dialog().get_by_label("Peça 2 *", exact=True).select_option(label="QA-CORREIA — Correia QA")
                    dialog().get_by_label("Desconto total (R$)").fill("10,00")
                    dialog().get_by_label("Frete (R$)").fill("5,00")
                    dialog().get_by_label("Condições de pagamento", exact=False).fill("À vista")
                    save("Criar orçamento")
                    page.get_by_role("button", name="Abrir", exact=True).click()
                    expect(dialog().locator(".grand-total")).to_contain_text("294,90")
                    dialog().get_by_role("button", name="Registrar envio", exact=True).click()
                    expect(page.get_by_role("dialog")).to_have_count(0)

                    # Change the catalog after sending: quote must keep its original values.
                    nav("Catálogo de peças")
                    page.get_by_role("row").filter(has_text="QA-FILTRO").get_by_role("button", name="Editar", exact=True).click()
                    dialog().get_by_label("Preço de referência", exact=False).fill("999,00")
                    save()
                    nav("Orçamentos")
                    page.get_by_role("button", name="Abrir", exact=True).click()
                    expect(dialog().locator(".grand-total")).to_contain_text("294,90")
                    page.emulate_media(media="print")
                    expect(page.locator(".print-document")).to_be_visible()
                    expect(page.locator(".print-document")).to_contain_text("DOCUMENTO NÃO FISCAL")
                    page.screenshot(path=str(OUTPUT / "03-print.png"), full_page=True)
                    page.emulate_media(media="screen")
                    dialog().get_by_role("button", name="Criar revisão", exact=True).click()
                    expect(page.get_by_role("dialog")).to_have_count(0)
                    page.get_by_role("row").filter(has_text="Rascunho").get_by_role("button", name="Abrir", exact=True).click()
                    dialog().get_by_role("button", name="Editar", exact=True).click()
                    dialog().get_by_label("Observações", exact=True).fill("Revisão de aceite QA")
                    save("Salvar orçamento")
                    page.get_by_role("row").filter(has_text="Rascunho").get_by_role("button", name="Abrir", exact=True).click()
                    dialog().get_by_role("button", name="Registrar envio", exact=True).click()
                    expect(page.get_by_role("dialog")).to_have_count(0)
                    page.get_by_role("row").filter(has_text="Enviado").get_by_role("button", name="Abrir", exact=True).click()
                    dialog().get_by_role("button", name="Aceitar e criar pedido", exact=True).click()
                    expect(page.get_by_role("dialog")).to_have_count(0)

                    nav("Pedidos")
                    page.get_by_role("button", name="Abrir", exact=True).click()
                    expect(dialog().locator(".grand-total")).to_contain_text("294,90")
                    dialog().get_by_role("button", name="Iniciar separação", exact=True).click()
                    expect(page.get_by_role("dialog")).to_have_count(0)
                    page.get_by_role("button", name="Abrir", exact=True).click()
                    dialog().get_by_role("button", name="Concluir pedido", exact=True).click()
                    expect(page.get_by_role("dialog")).to_have_count(0)
                    expect(page.get_by_role("row").filter(has_text="#0001")).to_contain_text("Concluído")

                    nav("Agenda")
                    page.get_by_role("button", name="Concluir Retornar orçamento QA").click()
                    expect(page.get_by_role("button", name="Concluir Retornar orçamento QA")).to_have_count(0)
                    nav("Negociações")
                    page.get_by_role("button", name="Novo atendimento", exact=True).first.click()
                    dialog().get_by_label("Cliente *", exact=True).select_option(index=1)
                    dialog().get_by_label("Título do atendimento", exact=False).fill("Prazo QA")
                    save()
                    page.once("dialog", lambda prompt: prompt.accept("Prazo incompatível"))
                    page.get_by_label("Mover Prazo QA").select_option("lost")
                    expect(page.locator(".column-lost")).to_contain_text("Prazo QA")
                    nav("Visão geral")
                    expect(page.locator(".stat-2")).to_contain_text("50%")
                    expect(page.locator(".deal-preview").filter(has_text="Reposição QA")).to_contain_text("294,90")
                    page.screenshot(path=str(OUTPUT / "04-dashboard.png"), full_page=True)

                    nav("Clientes")
                    page.get_by_role("button", name="Abrir Transportadora QA", exact=True).click()
                    whatsapp = dialog().get_by_role("link", name="Abrir WhatsApp", exact=False)
                    expect(whatsapp).to_have_attribute("href", "https://wa.me/5531999999999")
                    expect(dialog().get_by_role("heading", name="Histórico da operação")).to_be_visible()
                    page.keyboard.press("Escape")

                    # Layout checks use rendered dimensions, allowing internal table scrolling.
                    for width in (320, 390, 768, 1440):
                        page.set_viewport_size({"width": width, "height": 900})
                        for name in ("Visão geral", "Clientes", "Catálogo de peças", "Negociações", "Orçamentos", "Agenda"):
                            nav(name)
                            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), f"Horizontal overflow: {width}px, {name}"
                        if width == 390:
                            nav("Clientes")
                            page.get_by_role("button", name="Novo cliente", exact=True).click()
                            dialog().get_by_label("Nome / razão social", exact=False).fill("Teste de formulário móvel")
                            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "Mobile form overflow"
                            page.screenshot(path=str(OUTPUT / "06-mobile-form.png"), full_page=True)
                            page.keyboard.press("Escape")
                            nav("Visão geral")
                            page.screenshot(path=str(OUTPUT / "05-mobile.png"), full_page=True)
                    page.set_viewport_size({"width": 1440, "height": 1000})

                    nav("Configurações")
                    page.get_by_label("Nome da empresa", exact=False).fill("Distribuidora QA")
                    save_settings()
                    with page.expect_download() as download_info:
                        page.get_by_role("button", name="Baixar backup completo", exact=True).click()
                    backup_path = OUTPUT / "browser-backup.sqlite"
                    download_info.value.save_as(backup_path)
                    assert backup_path.read_bytes().startswith(b"SQLite format 3")

                    before = read_state()
                    assert len(before["orders"]) == 1
                    assert before["orders"][0]["totalCents"] == 29490
                    assert len(before["quotes"]) == 2
                    assert before["dashboard"]["winRate"] == 0.5
                    stop_server(server)
                    server = start_server(Path(directory) / "data", log)
                    page.reload(wait_until="networkidle")
                    assert read_state()["orders"] == before["orders"]
                    # Exercise cached-token recovery after another backend restart, without reload.
                    nav("Configurações")
                    save_settings()
                    stop_server(server)
                    server = start_server(Path(directory) / "data", log)
                    page.get_by_label("Nome da empresa", exact=False).fill("Distribuidora QA recuperada")
                    save_settings()
                    assert read_state()["settings"]["companyName"] == "Distribuidora QA recuperada"

                    stop_server(server)
                    restored = Path(directory) / "restored"
                    restore = subprocess.run(["node", "--import", "tsx", "scripts/restore.ts", str(backup_path)], cwd=ROOT, env={**os.environ, "CRM_DATA_DIR": str(restored)}, capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
                    assert restore.returncode == 0, restore.stdout + restore.stderr
                    server = start_server(restored, log)
                    restored_state = read_state()
                    assert restored_state["orders"] == before["orders"]
                    assert restored_state["quotes"] == before["quotes"]
                    assert restored_state["settings"]["companyName"] == "Distribuidora QA"
                    page.reload(wait_until="networkidle")
                    nav("Pedidos")
                    expect(page.get_by_role("row").filter(has_text="#0001")).to_contain_text("Concluído")
                    assert not errors, errors
                    browser.close()
                report = {"result": "passed", "journey": "cliente → catálogo → negociação → tarefa → orçamento → revisão → pedido", "quoteTotalCents": 29490, "orders": 1, "quoteRevisions": 2, "winRate": 0.5, "widths": [320, 390, 768, 1440], "restartPersistence": True, "backupRestored": True, "failedSavePreserved": True, "csrfAfterRestart": True, "pageErrors": errors}
                (OUTPUT / "result.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf8")
                print("Browser acceptance passed: complete journey, responsive layout, printing, restart and backup restoration")
            finally:
                stop_server(server)


if __name__ == "__main__":
    run()
