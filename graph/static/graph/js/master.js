let toolbarsToClose = true;

function UpdateToolbarsToClose() {
    let btn = $("#collapse-toolbars");
    let psMenus = $('.ps-menu');
    let statuses = [];
    for (let i = 0; i < psMenus.length; i++) {
        statuses.push(psMenus.eq(i).data("opened"));
    }

    if (statuses.every(e => e)) {
        btn.empty();
        btn.append("<i class='fa fa-expand' aria-hidden='true'></i>");
        toolbarsToClose = true
    }

    if (statuses.every(e => !e)) {
        btn.empty();
        btn.append("<i class='fa fa-compress' aria-hidden='true'></i>");
        toolbarsToClose = false
    }
}

function ToggleMenus() {
    let btn = $("#collapse-toolbars");
    let psMenus = $('.ps-menu');

    btn.empty();

    if (toolbarsToClose) {
        btn.append("<i class='fa fa-compress' aria-hidden='true'></i>");
        for (let i = 0; i < psMenus.length; i++) {
            if (psMenus.eq(i).data("opened")) {
                    psMenus.eq(i).find(".ps-menu-btn").click()
                }
            }
        toolbarsToClose = false
    } else {
        btn.append("<i class='fa fa-expand' aria-hidden='true'></i>");
        for (let i = 0; i < psMenus.length; i++) {
            if (!psMenus.eq(i).data("opened")) {
                    psMenus.eq(i).find(".ps-menu-btn").click()
                }
            }
        toolbarsToClose = true
    }
}


// TODO Recode into single function
function TogglePSMenuLeft(psMenuBtn) {
    let psMenu = psMenuBtn.closest('.ps-menu');

    if (psMenu.data("opened")) {
        psMenu.data("opened", false);
        psMenu.animate({"left": -psMenu.width() - 10}, 400, function () {
           psMenu.find(".ps-menu-btn.left i").css({transform: 'rotate(' + 180 + 'deg)'});
        });
    } else {
        psMenu.data("opened", true);
        psMenu.animate({"left": 10}, 400, function () {
           psMenu.find(".ps-menu-btn.left i").css({transform: 'rotate(' + 0 + 'deg)'});
        });
    }

    UpdateToolbarsToClose()
}

function TogglePSMenuBottom(psMenuBtn) {
    let psMenu = psMenuBtn.closest('.ps-menu');

    if (psMenu.data("opened")) {
        psMenu.data("opened", false);
        psMenu.animate({"bottom": -psMenu.height() - 10}, 400, function () {
           psMenu.find(".ps-menu-btn.bottom i").css({transform: 'rotate(' + 180 + 'deg)'});
        });
    } else {
        psMenu.data("opened", true);
        psMenu.animate({"bottom": 0}, 400, function () {
           psMenu.find(".ps-menu-btn.bottom i").css({transform: 'rotate(' + 0 + 'deg)'});
        });
    }

    UpdateToolbarsToClose()
}

function TogglePSMenuRight(psMenuBtn) {
    let psMenu = psMenuBtn.closest('.ps-menu');

    if (psMenu.data("opened")) {
        psMenu.data("opened", false);
        psMenu.animate({"right": -psMenu.width() - 10}, 400, function () {
           psMenu.find(".ps-menu-btn.right i").css({transform: 'rotate(' + 180 + 'deg)'});
        });
    } else {
        psMenu.data("opened", true);
        psMenu.animate({"right": 10}, 400, function () {
           psMenu.find(".ps-menu-btn.right i").css({transform: 'rotate(' + 0 + 'deg)'});
        });
    }

    UpdateToolbarsToClose()
}

$(document).ready( function () {
    $(".ps-menu-btn.left").on('click', function () {
        TogglePSMenuLeft($(this))
    });

    $(".ps-menu-btn.bottom").on('click', function () {
        TogglePSMenuBottom($(this))
    });

    $(".ps-menu-btn.right").on('click', function () {
        TogglePSMenuRight($(this))
    });
} );