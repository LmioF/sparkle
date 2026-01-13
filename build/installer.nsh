!macro customInstall
  ${ifNot} ${isUpdated}
    CreateShortcut "$DESKTOP\${PRODUCT_FILENAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe"
  ${endIf}
!macroend
