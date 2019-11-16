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

function TogglePSMenu(psMenuBtn, btnPosition) {
    let psMenu = psMenuBtn.closest('.ps-menu');

    let moveTrack = null;
    let defaultPosition = null;
    let selector = null;

    if (btnPosition === "bottom") {
        moveTrack = {"bottom": -psMenu.height() - 10};
        defaultPosition = {"bottom": 0};
        selector = ".ps-menu-btn.bottom i";
    }

    if (btnPosition === "left") {
        moveTrack = {"left": -psMenu.width() - 10};
        defaultPosition = {"left": 10};
        selector = ".ps-menu-btn.left i";
    }

    if (btnPosition === "right") {
        moveTrack = {"right": -psMenu.width() - 10};
        defaultPosition = {"right": 10};
        selector = ".ps-menu-btn.right i";
    }

    if (psMenu.data("opened")) {
        psMenu.data("opened", false);
        psMenu.animate(moveTrack, 400, function () {
           psMenu.find(selector).css({transform: 'rotate(' + 180 + 'deg)'});
        });
    } else {
        psMenu.data("opened", true);
        psMenu.animate(defaultPosition, 400, function () {
           psMenu.find(selector).css({transform: 'rotate(' + 0 + 'deg)'});
        });
    }

    UpdateToolbarsToClose()
}


$(document).ready( function () {
    $(".ps-menu-btn.left").on('click', function () {
        TogglePSMenu($(this), "left")
    });

    $(".ps-menu-btn.bottom").on('click', function () {
        TogglePSMenu($(this), "bottom")
    });

    $(".ps-menu-btn.right").on('click', function () {
        TogglePSMenu($(this), "right")
    });

    $(".image-title").hover(function () {
        let target = $($(this).data("target"));
        target.addClass("pulse")
    }, function () {
        let target = $($(this).data("target"));
        target.removeClass("pulse")
    })

} );