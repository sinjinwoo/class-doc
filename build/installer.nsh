; Included automatically by electron-builder's NSIS target (build/installer.nsh).
;
; class-doc stores all user data (SQLite DB, registered templates, generated
; documents) in a `class-doc` folder next to the executable — i.e. inside
; $INSTDIR (see src/main/paths.ts). electron-builder's default uninstaller
; deletes $INSTDIR recursively, and installing an update runs the *old*
; version's uninstaller first (with --updated), so without this override an
; update would wipe every teacher's data.
;
; customRemoveFiles replaces that default removal step: delete everything in
; $INSTDIR except the `class-doc` data folder, then remove $INSTDIR only if it
; ended up empty. Applies to both updates and a real uninstall (data is kept
; on uninstall too; the teacher can delete the folder by hand).
;
; Note: the protection lives in the uninstaller of the version being
; replaced, so it only covers updates *from* a release that already shipped
; this file (v0.1.0 onward).
!macro customRemoveFiles
  ; Move out of $INSTDIR so its contents can be removed.
  SetOutPath $TEMP

  FindFirst $R0 $R1 "$INSTDIR\*.*"
  ${DoWhile} $R1 != ""
    ${If} $R1 != "."
    ${AndIf} $R1 != ".."
    ${AndIf} $R1 != "class-doc"
      ${If} ${FileExists} "$INSTDIR\$R1\*.*"
        RMDir /r "$INSTDIR\$R1"
      ${Else}
        Delete "$INSTDIR\$R1"
      ${EndIf}
    ${EndIf}
    FindNext $R0 $R1
  ${Loop}
  FindClose $R0

  ; Non-recursive: only succeeds when nothing (no data folder) is left.
  RMDir $INSTDIR
!macroend
