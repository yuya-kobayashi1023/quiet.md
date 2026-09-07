; Quiet の NSIS フック。
;
; アンインストールで、右クリックメニューの登録（ADR-014）を残さない。
; 消えた実行ファイルを指す「Quiet で開く」がメニューに残らないようにする。
; currentUser インストールなので、書き込み先と同じ HKCU を消す。

!macro NSIS_HOOK_PREUNINSTALL
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.md\shell\QuietOpen"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.markdown\shell\QuietOpen"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\QuietOpen"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\QuietOpen"
!macroend
