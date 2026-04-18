import { useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import LightGallery from 'lightgallery/react';
import lgZoom from 'lightgallery/plugins/zoom';
import lgVideo from 'lightgallery/plugins/video';
import type { GalleryItem } from 'lightgallery/lg-utils';
import type { LightGallery as LightGalleryInstance } from 'lightgallery/lightgallery';
import type { InitDetail } from 'lightgallery/lg-events';

export interface MediaLightboxHandle {
  openGallery: (index: number) => void;
}

interface MediaLightboxProps {
  slides: GalleryItem[];
}

const MediaLightbox = forwardRef<MediaLightboxHandle, MediaLightboxProps>(
  function MediaLightbox({ slides }, ref) {
    const lgInstance = useRef<LightGalleryInstance | null>(null);

    const onInit = useCallback((detail: InitDetail) => {
      if (detail) {
        lgInstance.current = detail.instance;
      }
    }, []);

    // Sync dynamicEl when slides change (e.g., post data updated)
    useEffect(() => {
      if (lgInstance.current) {
        lgInstance.current.refresh(slides);
      }
    }, [slides]);

    useImperativeHandle(ref, () => ({
      openGallery: (index: number) => {
        lgInstance.current?.openGallery(index);
      },
    }));

    return (
      <div className="hidden">
        <LightGallery
          onInit={onInit}
          plugins={[lgZoom, lgVideo]}
          licenseKey="GPLv3-open-source"
          dynamic={true}
          dynamicEl={slides}
          speed={300}
          download={false}
          counter={true}
          escKey={true}
          keyPress={true}
          loop={false}
          closable={true}
          closeOnTap={true}
          controls={true}
          enableSwipe={true}
          enableDrag={true}
          hideScrollbar={true}
          // Video settings
          autoplayFirstVideo={false}
          autoplayVideoOnSlide={false}
          gotoNextSlideOnVideoEnd={false}
          // Zoom settings
          actualSize={true}
          showZoomInOutIcons={false}
          addClass="moments-lightbox"
        />
      </div>
    );
  },
);

export default MediaLightbox;
