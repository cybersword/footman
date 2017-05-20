const path = require('path');
const url = require('url');

const {app, BrowserWindow, Menu, shell, remote, ipcMain, Tray} = require('electron');

let appIcon = null;
const iconPath = path.join(__dirname, 'icon/star-red-16.png');

app.on('window-all-closed', function () {
    if (appIcon) appIcon.destroy();
});


const template = [
    {
        label: 'Edit',
        submenu: [
            {
                role: 'undo'
            },
            {
                role: 'redo'
            },
            {
                type: 'separator'
            },
            {
                role: 'cut'
            }
        ]
    },
    {
        label: 'View',
        submenu: [
            {
                role: 'reload'
            },
            {
                role: 'toggledevtools'
            },
            {
                type: 'separator'
            },
            {
                role: 'resetzoom'
            },
            {
                role: 'zoomin'
            },
            {
                role: 'zoomout'
            },
            {
                type: 'separator'
            },
            {
                role: 'togglefullscreen'
            }
        ]
    },
    {
        role: 'help',
        submenu: [
            {
                label: 'Learn More',
                click () {
                    shell.openExternal('https://github.com/cybersword/bee')
                }
            }
        ]
    }
];
if (process.platform === 'darwin') {
    template.unshift({
        // label: app.getName(),
        submenu: [
            {
                role: 'about'
            },
            {
                type: 'separator'
            },
            {
                role: 'services',
                submenu: []
            },
            {
                type: 'separator'
            },
            {
                role: 'hide'
            },
            {
                role: 'hideothers'
            },
            {
                role: 'unhide'
            },
            {
                type: 'separator'
            },
            {
                role: 'quit'
            }
        ]
    });
}
let menuApp = Menu.buildFromTemplate(template);
let menuTray = Menu.buildFromTemplate([
    {
        label: 'fileSync',
        enabled: false
    },
    {
        label: 'About',
        click () {
            shell.openExternal('https://github.com/cybersword/bee')
        }
    },
    {
        label: '切换环境',
        submenu: [
            {
                label: '环境1',
                click () {
                    console.log('切换到环境1');
                }
            },
            {
                label: '环境2',
                click () {
                    console.log('切换到环境2');
                }
            },
        ]
    },
    {
        role: 'quit'
    }
]);

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function init() {
    // Set menu
    Menu.setApplicationMenu(menuApp);
    // Set tray
    appIcon = new Tray(iconPath);
    appIcon.setToolTip(app.getName());
    appIcon.setContextMenu(menuTray);
    // Show window
    createWindow();
}

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 250,
        height: 600,
        title: app.getName(),
        icon: iconPath,
    });

    // and load the index.html of the app.
    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    // Open the DevTools.
    // mainWindow.webContents.openDevTools();

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', init);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
