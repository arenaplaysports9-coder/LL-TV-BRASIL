#include <obs-module.h>
#include <obs-frontend-api.h>

#include <QDesktopServices>
#include <QLabel>
#include <QPushButton>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QWidget>
#include <QUrl>
#include <QTimer>
#include <QDateTime>
#include <QFrame>

OBS_DECLARE_MODULE()
OBS_MODULE_USE_DEFAULT_LOCALE("lltv-placar", "pt-BR")

namespace {
constexpr const char *kDockId = "lltv-brasil-placar-dock";
constexpr const char *kPanelUrl = "http://127.0.0.1:8787/";
constexpr const char *kOverlayUrl = "http://127.0.0.1:8787/overlay.html";
QWidget *g_dockWidget = nullptr;
QLabel *g_streamStatus = nullptr;
QLabel *g_recordStatus = nullptr;
QTimer *g_statusTimer = nullptr;

void openUrl(const char *url)
{
    QDesktopServices::openUrl(QUrl(QString::fromUtf8(url)));
}

void refreshStatus()
{
    if (g_streamStatus) {
        const bool active = obs_frontend_streaming_active();
        g_streamStatus->setText(active ? QStringLiteral("● TRANSMISSÃO: AO VIVO")
                                       : QStringLiteral("● TRANSMISSÃO: PARADA"));
    }
    if (g_recordStatus) {
        const bool active = obs_frontend_recording_active();
        g_recordStatus->setText(active ? QStringLiteral("● GRAVAÇÃO: ATIVA")
                                       : QStringLiteral("● GRAVAÇÃO: PARADA"));
    }
}

QPushButton *makeButton(const QString &text)
{
    auto *button = new QPushButton(text);
    button->setMinimumHeight(36);
    button->setCursor(Qt::PointingHandCursor);
    return button;
}

QWidget *createDockWidget()
{
    auto *root = new QWidget();
    root->setObjectName(QStringLiteral("LLTVBrasilPlacarDock"));
    root->setMinimumWidth(270);

    auto *layout = new QVBoxLayout(root);
    layout->setContentsMargins(14, 14, 14, 14);
    layout->setSpacing(9);

    auto *title = new QLabel(QStringLiteral("LLTV BRASIL"));
    title->setAlignment(Qt::AlignCenter);
    title->setStyleSheet(QStringLiteral("font-size:20px;font-weight:800;color:#d6ad55;"));
    auto *subtitle = new QLabel(QStringLiteral("A CASA DAS LIGAS ALTERNATIVAS\nCENTRAL DE PLACAR ESPORTIVO"));
    subtitle->setAlignment(Qt::AlignCenter);
    subtitle->setWordWrap(true);
    subtitle->setStyleSheet(QStringLiteral("font-size:10px;color:#c9c9c9;letter-spacing:1px;"));
    layout->addWidget(title);
    layout->addWidget(subtitle);

    auto *line = new QFrame();
    line->setFrameShape(QFrame::HLine);
    line->setStyleSheet(QStringLiteral("color:#8f7134;"));
    layout->addWidget(line);

    auto *panel = makeButton(QStringLiteral("ABRIR CENTRAL DE CONTROLE"));
    auto *overlay = makeButton(QStringLiteral("ABRIR OVERLAY DO PLACAR"));
    layout->addWidget(panel);
    layout->addWidget(overlay);
    QObject::connect(panel, &QPushButton::clicked, [] { openUrl(kPanelUrl); });
    QObject::connect(overlay, &QPushButton::clicked, [] { openUrl(kOverlayUrl); });

    auto *section = new QLabel(QStringLiteral("CONTROLES DO OBS STUDIO"));
    section->setStyleSheet(QStringLiteral("font-weight:700;color:#d6ad55;margin-top:8px;"));
    layout->addWidget(section);

    auto *startStream = makeButton(QStringLiteral("INICIAR TRANSMISSÃO"));
    auto *stopStream = makeButton(QStringLiteral("PARAR TRANSMISSÃO"));
    auto *startRecord = makeButton(QStringLiteral("INICIAR GRAVAÇÃO"));
    auto *stopRecord = makeButton(QStringLiteral("PARAR GRAVAÇÃO"));
    auto *saveReplay = makeButton(QStringLiteral("SALVAR REPLAY BUFFER"));
    layout->addWidget(startStream);
    layout->addWidget(stopStream);
    layout->addWidget(startRecord);
    layout->addWidget(stopRecord);
    layout->addWidget(saveReplay);

    QObject::connect(startStream, &QPushButton::clicked, [] { obs_frontend_streaming_start(); });
    QObject::connect(stopStream, &QPushButton::clicked, [] { obs_frontend_streaming_stop(); });
    QObject::connect(startRecord, &QPushButton::clicked, [] { obs_frontend_recording_start(); });
    QObject::connect(stopRecord, &QPushButton::clicked, [] { obs_frontend_recording_stop(); });
    QObject::connect(saveReplay, &QPushButton::clicked, [] {
        if (obs_frontend_replay_buffer_active())
            obs_frontend_replay_buffer_save();
    });

    g_streamStatus = new QLabel();
    g_recordStatus = new QLabel();
    g_streamStatus->setStyleSheet(QStringLiteral("font-weight:700;color:#e7e7e7;"));
    g_recordStatus->setStyleSheet(QStringLiteral("font-weight:700;color:#e7e7e7;"));
    layout->addSpacing(5);
    layout->addWidget(g_streamStatus);
    layout->addWidget(g_recordStatus);

    auto *refresh = makeButton(QStringLiteral("ATUALIZAR STATUS"));
    layout->addWidget(refresh);
    QObject::connect(refresh, &QPushButton::clicked, [] { refreshStatus(); });

    auto *foot = new QLabel(QStringLiteral("Painel local: 127.0.0.1:8787\nCelular: use o endereço LAN exibido no terminal do servidor."));
    foot->setWordWrap(true);
    foot->setStyleSheet(QStringLiteral("font-size:10px;color:#999;margin-top:8px;"));
    layout->addStretch(1);
    layout->addWidget(foot);

    root->setStyleSheet(QStringLiteral(
        "QWidget#LLTVBrasilPlacarDock{background:#171717;color:#f4f4f4;}"
        "QPushButton{background:#292929;color:#f7f7f7;border:1px solid #80652f;"
        "border-radius:5px;padding:7px;font-weight:700;}"
        "QPushButton:hover{background:#3b3020;border-color:#d6ad55;}"
        "QPushButton:pressed{background:#5a4522;}"));

    refreshStatus();
    return root;
}

void openPanelFromMenu(void *)
{
    openUrl(kPanelUrl);
}
} // namespace

bool obs_module_load(void)
{
    g_dockWidget = createDockWidget();
    if (!obs_frontend_add_dock_by_id(kDockId, "LLTV Brasil – Placar", g_dockWidget)) {
        delete g_dockWidget;
        g_dockWidget = nullptr;
        blog(LOG_ERROR, "LLTV Placar: não foi possível registrar o dock no OBS.");
        return false;
    }

    obs_frontend_add_tools_menu_item("Abrir Central LLTV Brasil", openPanelFromMenu, nullptr);

    g_statusTimer = new QTimer();
    QObject::connect(g_statusTimer, &QTimer::timeout, [] { refreshStatus(); });
    g_statusTimer->start(1500);

    blog(LOG_INFO, "LLTV Placar: dock nativo carregado. Abra em Exibir > Docks > LLTV Brasil – Placar.");
    return true;
}

void obs_module_unload(void)
{
    if (g_statusTimer) {
        g_statusTimer->stop();
        delete g_statusTimer;
        g_statusTimer = nullptr;
    }
    obs_frontend_remove_dock(kDockId);
    g_dockWidget = nullptr;
    g_streamStatus = nullptr;
    g_recordStatus = nullptr;
    blog(LOG_INFO, "LLTV Placar: módulo descarregado.");
}
