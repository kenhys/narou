/* -*- coding: utf-8 -*-
 *
 * Copyright 2013 whiteleaf. All rights reserved.
 */

var Narou = (function() {
  "use strict";

  var Narou = {};
  var storage_cache = null;
  var storage = null;

  /*************************************************************************
   * ローカルストレージ
   *************************************************************************/
  var Storage = Narou.Storage = function() {
    this.initialize();
  };

  $.extend(Storage.prototype, {
    storage_name: "Narou.rb_WEB_UI_saved",
    initialize: function() {
      if (!storage_cache) {
        storage_cache = this.load();
      }
      this.objects = storage_cache;
    },

    load: function() {
      var objects = localStorage.getItem(this.storage_name);
      return objects ? JSON.parse(objects) : {};
    },

    save: function() {
      localStorage.setItem(this.storage_name, JSON.stringify(this.objects));
    },

    get: function(key) {
      return this.objects[key];
    },

    set: function(key, value) {
      this.objects[key] = value;
      return this;
    },
  });

  storage = new Storage();

  /*************************************************************************
   * ユーティリティ
   *************************************************************************/
  $.extend(Narou, {
    registerCloseHandler: function(callback) {
      // Chrome, IEですぐにclickイベントをバインドすると、メニュー表示時の
      // クリックに反応してしまう（表示上のズレによって、クリック時のマウス
      // 座標上に対象オブジェクトが存在しないため）ので、イベント作成をほんの
      // 少し遅らせる
      setTimeout(function() {
        // 関係ないところをクリックした時に閉じる
        $(document).one("click", callback);
      }, 100);
    },

    popupMenu: function(menu_id, pos, close_menu_handler) {
      var $menu = $(menu_id);
      var left = $(window).width() < pos.x - $(document).scrollLeft() + $menu.outerWidth() ?
                                     pos.x - $menu.outerWidth() : pos.x;
      var top = $(window).height() < pos.y - $(document).scrollTop() + $menu.outerHeight() ?
                                     pos.y - $menu.outerHeight() : pos.y;
      $menu.show().offset({
        left: left, top: top
      });
      Narou.registerCloseHandler(close_menu_handler);
    },

    // http://qiita.com/osakanafish/items/c64fe8a34e7221e811d0
    formatDate: function(date, format) {
      if (!format) format = 'YYYY-MM-DD hh:mm:ss.SSS';
      format = format.replace(/YYYY/g, date.getFullYear());
      format = format.replace(/MM/g, ('0' + (date.getMonth() + 1)).slice(-2));
      format = format.replace(/DD/g, ('0' + date.getDate()).slice(-2));
      format = format.replace(/hh/g, ('0' + date.getHours()).slice(-2));
      format = format.replace(/mm/g, ('0' + date.getMinutes()).slice(-2));
      format = format.replace(/ss/g, ('0' + date.getSeconds()).slice(-2));
      if (format.match(/S/g)) {
        var milliSeconds = ('00' + date.getMilliseconds()).slice(-3);
        var length = format.match(/S/g).length;
        for (var i = 0; i < length; i++) format = format.replace(/S/, milliSeconds.substring(i, i + 1));
      }
      return format;
    },
  });

  /*************************************************************************
   * Push 通知管理
   *************************************************************************/
  var Notification = Narou.Notification = function() {
    this.initialize();
  };

  Notification.instance = function() {
    if (!this.__instance) {
      this.__instance = new this;
    }
    return this.__instance;
  };

  $.extend(Notification.prototype, {
    RETRY_LIMIT: 5,
    RETRY_WAIT: 2000,

    initialize: function() {
      this.events = {};
      this.retry_count = this.RETRY_LIMIT;
      this.connect();
    },

    connect: function() {
      if (this.connection) return;
      var self = this;
      this.connected = false;
      var connection = window.c = this.connection = new WebSocket(this.create_ws_uri());

      connection.onopen = function() {
        self.connected = true;
        self.trigger("console.clear");
        self.retry_count = self.RETRY_LIMIT;   // 接続出来たらリトライカウント回復
      };

      connection.onclose = function() {
        self.connection = null;
        // PCのスリープ等でコネクションが切れた場合に再接続する
        if (self.retry_count-- > 0) {
          setTimeout(function() {
            self.connected = false;
            self.connect();
          }, self.RETRY_WAIT);
        }
      };

      connection.onmessage = function(e) {
        if (e && e.data) {
          self.onmessage(JSON.parse(e.data));
        }
      };
    },

    create_ws_uri: function() {
      var host = location.hostname,
          port = location.port;
      return "ws://" + host + ":" + (parseInt(port) + 1) + "/";
    },

    onmessage: function(data) {
      var self = this;
      $.each(data, function(event, value) {
        self.trigger(event, value);
      });
    },

    on: function(event, block) {
      if (typeof block !== "function") {
        $.error("need a function");
      }
      var stack = this.events[event] || [];
      stack.push(block);
      this.events[event] = stack;
    },

    trigger: function(event, data) {
      var self = this;
      var stack = this.events[event] || [];
      $.each(stack, function() {
        this.call(self, data);
      });
    },

    send: function(json) {
      this.connection.send(JSON.stringify(json));
    },
  });

  /*************************************************************************
   * コンテキストメニュー
   *************************************************************************/
  var ContextMenu = Narou.ContextMenu = function(action, notification, tag) {
    this.action = action;
    this.notification = notification;
    this.tag = tag;
    this.closed = true;
    this.initializeConsoleDialog();
    this.initializeMenuEvent();
    this.initializeDiffListEvent();
  };

  $.extend(ContextMenu.prototype, {
    open: function(target_id, pos, callback) {
      this.target_id = target_id;
      if (!this.closed) {
        // メニューを開いた状態で直接ボタンを押した場合に一旦閉じるイベントを起こさせる
        $(document).trigger("click");
      }
      this.closed = false;
      Narou.popupMenu("#context-menu", pos, function() {
        $("#context-menu").hide();
        if (typeof callback === "function") {
          callback();
        }
      });
    },

    openConsoleDialog: function(callback) {
      if (typeof callback !== "function") return;
      var $console_dialog = $("#console-dialog");
      $console_dialog.one("shown.bs.modal", callback);
      $(document).one("cancel.narou.remove", function() {
        $console_dialog.modal("hide");
      });
      this.console.clear();
      $console_dialog.modal();
    },

    initializeConsoleDialog: function() {
      this.console = new Narou.Console(this.notification, {
        restore: false, buttons: false,
        id: "#each-console"
      });
    },

    openSelectDiffListDialog: function(target_id) {
      $.get("/api/diff_list", { target: target_id }, function(html) {
        bootbox.dialog({
          title: "表示したい差分を選択して下さい",
          message: html,
          backdrop: true,
          className: "diff-list-modal",
          buttons: {
            main: {
              label: "閉じる",
              className: "btn-default"
            },
          }
        });
      });
    },

    initializeDiffListEvent: function() {
      $(document).on("click", ".diff-list-container .list .item", function() {
        var target = $(this).parent().data("diffTarget");
        var number = $(this).data("diffItemNumber");
        $.post("/api/diff", { ids: [ target ], number: number });
        bootbox.hideAll();
      });
    },

    initializeMenuEvent: function() {
      var $context_menu = $("#context-menu");
      var self = this;
      $("#context-menu-setting").on("click", function(e) {
        e.preventDefault();
        location.href = "/novels/" + self.target_id + "/setting";
      });
      $("#context-menu-update").on("click", function(e) {
        e.preventDefault();
        self.openConsoleDialog(function() {
          self.action.update(self.target_id);
        });
      });
      $("#context-menu-send").on("click", function(e) {
        e.preventDefault();
        self.openConsoleDialog(function() {
          self.action.send(self.target_id);
        });
      });
      $("#context-menu-freeze-toggle").on("click", function(e) {
        e.preventDefault();
        self.action.freeze(self.target_id);
      });
      $("#context-menu-remove").on("click", function(e) {
        e.preventDefault();
        self.openConsoleDialog(function() {
          self.action.remove(self.target_id);
        });
      });
      $("#context-menu-edit-tag").on("click", function(e) {
        e.preventDefault();
        self.tag.openEditor(self.target_id);
      });
      $("#context-menu-convert").on("click", function(e) {
        e.preventDefault();
        self.openConsoleDialog(function() {
          self.action.convert(self.target_id);
        });
      });
      $("#context-menu-diff").on("click", function(e) {
        e.preventDefault();
        self.openSelectDiffListDialog(self.target_id);
      });
      $("#context-menu-inspect").on("click", function(e) {
        e.preventDefault();
        self.openConsoleDialog(function() {
          self.action.inspect(self.target_id);
        });
      });
      $("#context-menu-folder").on("click", function(e) {
        e.preventDefault();
        self.action.folder(self.target_id);
      });
      $("#context-menu-backup").on("click", function(e) {
        e.preventDefault();
        self.openConsoleDialog(function() {
          self.action.backup(self.target_id);
        });
      });
    }
  });

  /*************************************************************************
   * アクション
   *************************************************************************/
  var Action = Narou.Action = function(table) {
    this.table = table;
  };

  $.extend(Action.prototype, {
    _getSelectedIds: function(args) {
      if (typeof args !== "undefined" && args.length > 0) {
        return Array.prototype.slice.call(args);
      }
      var ids = [];
      $.each(this.table.rows(".selected").data(), function(i, val) {
        ids.push(val.id);
      });
      return ids;
    },

    selectAll: function() {
      this.table.$("tr").addClass("selected");
      this.table.fireChangeSelect();
    },

    selectView: function() {
      $("#novel-list tbody tr").addClass("selected");
      this.table.fireChangeSelect();
    },

    selectClear: function() {
      this.table.$("tr.selected").removeClass("selected");
      this.table.fireChangeSelect();
    },

    download: function() {
      var download_modal = bootbox.dialog({
        title: "ダウンロードする小説のURL、もしくはNコードを入力(複数可)",
        message: '<textarea id="download-input" class="form-control" rows="3"></textarea>',
        backdrop: true,
        buttons: {
          cancel: {
            label: "キャンセル",
            className: "btn-default"
          },
          main: {
            label: "OK",
            className: "btn-primary",
            callback: function() {
              var targets = $("#download-input").val();
              $.post("/api/download", { targets: targets });
            }
          }
        }
      });
      download_modal.one("shown.bs.modal", function () {
        $("#download-input").focus();
      });
    },

    downloadForce: function() {
      var ids = this._getSelectedIds(arguments);
      if (ids.length === 0) return;
      $.post("/api/download_force", { "ids": ids });
    },

    update: function() {
      var ids = this._getSelectedIds(arguments);
      $.post("/api/update", { "ids": ids });
    },

    updateView: function() {
      var self = this;
      var ids = [];
      $("#novel-list tbody tr").each(function(i, tr) {
        var data = self.table.row(tr).data();
        if (data) {
          ids.push(data.id);
        }
      });
      if (ids.length > 0) {
        $.post("/api/update", { "ids": ids });
      }
    },

    updateGeneralLastup: function() {
      bootbox.dialog({
        title: '最新話掲載日の更新',
        message: "凍結済みを除く各小説の最新話掲載日を更新します。<br>" +
                 "最新話掲載日は通常時のUPDATEでも更新されるので、手動で更新する必要は基本的にはありません。<br>" +
                 "掲載日だけを調べて、選択的にUPDATEをかけるなど、用途を理解した上で小説サイトのサーバーに負荷をかけない範囲でご利用下さい。",
        backdrop: true,
        buttons: {
          cancel: {
            label: "キャンセル",
            className: "btn-default",
          },
          main: {
            label: "更新する",
            className: "btn-primary",
            callback: function() {
              $.post("/api/update_general_lastup");
            }
          },
        }
      });
    },

    updateForce: function() {
      var ids = this._getSelectedIds(arguments);
      $.post("/api/update", { ids: ids, force: true });
    },

    send: function() {
      var ids = this._getSelectedIds(arguments);
      $.post("/api/send", { "ids": ids });
    },

    freeze: function() {
      var ids = this._getSelectedIds(arguments);
      if (ids.length === 0) return;
      $.post("/api/freeze", { "ids": ids });
    },

    freezeOn: function() {
      var ids = this._getSelectedIds(arguments);
      if (ids.length === 0) return;
      $.post("/api/freeze_on", { "ids": ids });
    },

    freezeOff: function() {
      var ids = this._getSelectedIds(arguments);
      if (ids.length === 0) return;
      $.post("/api/freeze_off", { "ids": ids });
    },

    _removeConfirmDialog: function(title, ids, callback) {
      var message = "";
      this.table.rows().data().each(function(data, idx) {
        if (ids.indexOf(data.id + "") !== -1) {
          message += "<li>" + data.title + "</li>";
        }
      });
      message = '<div style="max-height:300px;overflow:auto"><ul>' + message + '</ul></div>' +
                '<div class="checkbox pull-right"><label><input type="checkbox" id="check-remove-with-file">' +
                '保存フォルダ・ファイルも一緒に削除する</label></div><div class="clearfix"></div>';
      bootbox.dialog({
        title: title,
        message: message,
        buttons: {
          danger: {
            label: "削除する",
            className: "btn-danger",
            callback: function() {
              callback(true, $("#check-remove-with-file").prop("checked"));
              $(document).trigger("ok.narou.remove");
            }
          },
          main: {
            label: "キャンセル",
            className: "btn-default",
            callback: function() {
              callback(false, false);
              $(document).trigger("cancel.narou.remove");
            }
          }
        }
      });
    },

    remove: function() {
      var ids = this._getSelectedIds(arguments);
      if (ids.length === 0) return;
      this._removeConfirmDialog("選択した小説を削除しますか？", ids, function(result, with_file) {
        if (!result) return;
        $.post("/api/remove", { ids: ids, with_file: with_file });
      });
    },

    convert: function() {
      var ids = this._getSelectedIds(arguments);
      if (ids.length === 0) return;
      $.post("/api/convert", { "ids": ids });
    },

    diff: function() {
      var ids = this._getSelectedIds(arguments);
      if (ids.length === 0) return;
      $.post("/api/diff", { "ids": ids });
    },

    inspect: function() {
      var ids = this._getSelectedIds(arguments);
      if (ids.length === 0) return;
      $.post("/api/inspect", { "ids": ids });
    },

    folder: function() {
      var ids = this._getSelectedIds(arguments);
      if (ids.length === 0) return;
      $.post("/api/folder", { "ids": ids });
    },

    backup: function() {
      var ids = this._getSelectedIds(arguments);
      if (ids.length === 0) return;
      $.post("/api/backup", { "ids": ids });
    },

    settingBurn: function() {
      var ids = this._getSelectedIds(arguments);
      if (ids.length === 0) return;
      $.post("/api/setting_burn", { "ids": ids });
    },
  });

  /*************************************************************************
   * コンソール
   *************************************************************************/
  var Console = Narou.Console = function(notification, options) {
    this.options = $.extend({
      restore: true,   // コンソールの大きさを復元・保存するか
      buttons: true,   // 拡大縮小等のコントロールボタンを使用するか
      id: "#console",  // コンソールのID名
      buttons_id: "#console-buttons"   // コントロールボタンを格納している要素のID名
    }, options);
    this.initialize(notification);
  };

  $.extend(Console.prototype, {
    animate_duration: 200,

    initialize: function(notification) {
      this.notification = notification;
      this.last_char_was_return = true;
      this.console = $(this.options.id);
      this.init_scrollbar();
      if (this.options.buttons) this.init_buttons();
      this.init_events();
      this.init_notification();
      if (this.options.restore) this.restore_console_shape();
    },

    init_scrollbar: function() {
      this.console.perfectScrollbar({
        wheelspeed: 80,
        suppressScrollX: true,
        minScrollbarLength: 20,
      });
      this.original_height = this.console.height();
    },

    init_buttons: function() {
      var self = this;
      this.console.css("min-height", this.original_height);
      $(this.options.buttons_id + " .console-expand").on("click", function(e) {
        self.expand_console();
      });
      $(this.options.buttons_id + " .console-trash").on("click", function(e) {
        self.trash_console();
      });
    },

    init_events: function() {
      this.manage_resize_event();
      var self = this;
      this.console.on("resize", function() {
        if (!self.options.restore) return;
        var data = {
          height: self.console.height(),
          expanded: self.console.hasClass("expanded")
        };
        storage.set("console", data);
        storage.save();
      });
      this.init_events_progressbar();
      this.notification.on("console.clear", function() {
        self.clear();
      });
    },

    init_events_progressbar: function() {
      var self = this;
      var $progress = null;
      var createProgressHtml = function(percent) {
        return '<div class="progress"><div class="progress-bar progress-bar-success progress-bar-striped active" role="progressbar" aria-valuenow="' + percent + '" aria-valuemin="0" aria-valuemax="100" style="width:' + percent + '%"></div></div>';
      };
      var initializeProgressbar = function(percent) {
        self.puts(createProgressHtml(percent));
        $progress = self.console.find(".progress > div");
      };
      var setProgressValue = function(step) {
        $progress.attr("aria-valuenow", step)
                 .width(step + "%");
      };
      this.notification.on("progressbar.init", function() {
        initializeProgressbar(0);
      });
      this.notification.on("progressbar.step", function(value) {
        if ($progress) {
          setProgressValue(value);
        }
        else {
          initializeProgressbar(value);
        }
      });
      this.notification.on("progressbar.clear", function() {
        if (!$progress) return;
        // 表示と通信のタイムラグで100%付近のが表示されないまま消えてしまうので、
        // 演出的にプログレスバーの消去を遅らせて、100%付近まで表示する
        setProgressValue(100);
        $progress = null;
        setTimeout(function() {
          $(".progress").parent("div").remove();
        }, 500);
      });
    },

    init_notification: function() {
      var self = this;
      this.notification.on("echo", function(message) {
        self.print(message);
      });
    },

    manage_resize_event: function() {
      /*
      var con = this.console;
      con.data('x', con.outerWidth());
      con.data('y', con.outerHeight());
      $(document).on("mouseup", function () {
        if (con.outerWidth() != con.data('x') || con.outerHeight() != con.data('y')) {
          con.trigger("resize");
        }
        con.data('x', con.outerWidth());
        con.data('y', con.outerHeight());
      });
      */
    },

    restore_console_shape: function() {
      var data = storage.get("console");
      if (data) {
        this.console.height(data.height);
        if (data.expanded) this.toggle_expanded();
      }
    },

    scroll_to_bottom: function() {
      var con = this.console;
      con.scrollTop(con.prop("scrollHeight"));
    },

    position_is_bottom: function() {
      var con = this.console;
      return (con.scrollTop() >= con.prop("scrollHeight") - con.outerHeight() - 10);
    },

    print: function(str) {
      var self = this;
      var con = this.console;
      var last_char = str[str.length - 1];
      var lines = str.split("\n");
      var was_bottom = this.position_is_bottom();
      var last_char_is_return = last_char === "\n";
      if (last_char_is_return) {
        lines = lines.slice(0, -1);
      }
      if (!this.last_char_was_return) {
        var last = con.find("div.console-line:last-child");
        var char = lines.pop();
        if (char) last.append(char);
      }
      $.each(lines, function() {
        con.append("<div class=console-line>" + this);
      });
      con.perfectScrollbar("update");
      // 表示する段階で最下部までスクロールしてあった場合はスクロールする
      if (was_bottom) {
        this.scroll_to_bottom();
      }
      this.last_char_was_return = last_char_is_return;
    },

    puts: function(str) {
      if (str[str.length - 1] !== "\n") {
        this.print(str.concat("\n"));
      }
      else {
        this.print(str);
      }
    },

    expand_console: function() {
      var self = this;
      var calced_height;
      if (this.console.hasClass("expanded")) {
        calced_height = this.original_height;
      }
      else {
        var top = this.console.offset().top;
        calced_height = ($(window).height() - top) * 0.8;
      }
      var was_bottom = this.position_is_bottom();
      this.console.stop().animate({ height: calced_height }, this.animate_duration,
          // after do
          function() {
            if (was_bottom) self.scroll_to_bottom();
            self.console.trigger("resize");
            self.console.perfectScrollbar("update");
          });
      this.toggle_expanded();
    },

    toggle_expanded: function() {
      this.console.toggleClass("expanded");
      $(".console-expand > span").toggleClass("hide");
    },

    // コンソールのログを削除すると同時に、サーバの履歴も削除する
    trash_console: function() {
      this.clear();
      $.post("/api/clear_history");
    },

    clear: function() {
      this.console.find("div.console-line").remove();
    }
  });

  /*************************************************************************
   * タグ機能
   *************************************************************************/
  var Tag = Narou.Tag = (function(table) {
    this.table = table;
    this.updateCanvas();
  });

  $.extend(Tag.prototype, {
    updateCanvas: function() {
      var $canvas = $("#tag-list-canvas");
      this.registerEvents($canvas);
      $.get("/api/tag_list", function(source) {
        $canvas.html(source);
      });
    },

    registerEvents: function($target, stop_bubbling) {
      var self = this;
      if (typeof stop_bubbling === "undefined") stop_bubbling = true;
      var args = { stop_bubbling: stop_bubbling };
      $target.on("click", ".tag", args, function(e) {
        if (e.data.stop_bubbling) e.stopPropagation();
        var tag_name = $(this).data("tag");
        $("#tag-search").val(tag_name);
        storage.set("tag_search", tag_name);
        storage.save();
        self.table.draw();
      }).on("mousedown", ".tag", args, function(e) {
        // 範囲選択モードでもクリック出来るように
        if (e.data.stop_bubbling) e.stopPropagation();
      });
    },

    openEditor: function() {
      var ids = Action.prototype._getSelectedIds.call(this, arguments);
      if (ids.length === 0) return;
      this._createEditorField(ids, function(field) {
        bootbox.dialog({
          title: "タグの編集",
          message: field,
          buttons: {
            cancel: {
              label: "キャンセル",
              className: "btn-default",
              callback: function() {
              }
            },
            main: {
              label: "適用",
              className: "btn-primary",
              callback: function() {
                var states = {};
                var new_tag = $("#new-tag").val();
                $("#tag-editor-field input[type=checkbox]").each(function(i, v) {
                  states[$(v).data("tagname")] = $(v).data("checkState");
                });
                if (new_tag) {
                  states[new_tag] = 2;
                }
                $.post("/api/edit_tag", {
                  ids: ids,
                  states: states
                });
              }
            }
          }
        });
      });
    },

    _createEditorField: function(ids, callback) {
      var field = $("<div id=tag-editor-field class=form-group>");
      var self = this;
      var ids_count = ids.length;

      function calcState(count) {
        if (count === 0) {
          return 0;
        }
        else if (count < ids_count) {
          return 1;
        }
        else {
          return 2;
        }
      }

      $.post("/api/taginfo.json", { ids: ids }, function(taginfo) {
        $.each(taginfo, function(tagname, info) {
          var label = $('<label><input type="checkbox" data-tagname="' + tagname.replace(/"/g, "&quot;") +
            '" data-default-checkstate=' + calcState(info.count) + '> ' + info.html + '&nbsp;&nbsp;</label>');
          field.append(label);
        });
        var input = $('<div><input type="text" id="new-tag" placeholder="新規タグ" class="form-control"></div>' +
            '<div><small>（複数追加する場合は半角スペースで区切る）</small></div>');
        field.append(input);
        self._registerEventsForEditorField(field);
        callback(field);
      });
    },

    _registerEventsForEditorField: function(field) {
      function setCheckState(element, state) {
        switch (state) {
        case 0:
          element.prop("indeterminate", false);
          element.prop("checked", false);
          break;
        case 1:
          if (element.data("defaultCheckstate") == 1) {
            element.prop("indeterminate", true);
            element.prop("checked", false);
            break;
          }
          state++;
        case 2:
          element.prop("indeterminate", false);
          element.prop("checked", true);
          break;
        }
        element.data("checkState", state);
      }

      field.find("input[type=checkbox]")
        .on("click", function(e) {
          var elm = $(e.target);
          var next_state = (elm.data("checkState") + 1) % 3;
          setCheckState(elm, next_state);
        })
        .each(function(i, v) {
          var elm = $(v);
          setCheckState(elm, elm.data("defaultCheckstate"));
        });
    },
  });

  return Narou;
})();

