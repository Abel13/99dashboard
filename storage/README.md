# Storage local

Esta pasta permite rodar o 99Dashboard em qualquer máquina sem depender dos caminhos do ambiente Oracle/WSL.

- `emls/`: coloque aqui os arquivos `.eml` do 99Freelas ou deixe a importação Gmail salvar automaticamente.
- `data/feedback.json`: status/feedback salvo pelos botões do dashboard.
- `out/opportunities.feedback.json`: JSON final lido pelo dashboard.
- `pages/`: cache das páginas enriquecidas.

Em produção, você pode manter este diretório no próprio servidor ou apontar as variáveis `SOFTWAREHOUSE_*` para outro volume persistente.
