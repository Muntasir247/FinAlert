import { useState, useEffect } from 'react';
import { Keyboard, Platform, KeyboardEvent } from 'react-native';

export function useKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e: KeyboardEvent) => {
      setKeyboardHeight(e.endCoordinates.height);
      setIsKeyboardVisible(true);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Safe bottom padding for ScrollViews across platforms:
  // On Android (with edgeToEdgeEnabled), soft keyboard covers content without window resize,
  // so we add the keyboard height + comfortable clearance.
  // On iOS, KeyboardAvoidingView or automaticallyAdjustKeyboardInsets handles root offset,
  // so we only add moderate padding.
  const keyboardPaddingBottom = keyboardHeight > 0
    ? (Platform.OS === 'android' ? keyboardHeight + 80 : 80)
    : 0;

  return { keyboardHeight, isKeyboardVisible, keyboardPaddingBottom };
}
